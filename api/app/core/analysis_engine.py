"""
General analysis engine orchestration.

This module intentionally contains cross-analysis concerns:
- request-level validation,
- common integrity checks,
- high-level dispatch to nodal/mesh algorithms.

Algorithm-specific implementations should live in dedicated modules
(e.g. `mesh_analysis.py`) and be called from `run_analysis`.
"""

from collections import deque
from collections import defaultdict
import os
import traceback
import warnings
import sympy as sp

from app.core.models import AnalysisRequest, AnalysisResult, CircuitComponent

try:
  from lcapy import Circuit
  from lcapy.netlist import Netlist
except Exception:  # pragma: no cover - runtime fallback if dependency missing
  Circuit = None  # type: ignore[assignment]
  Netlist = None  # type: ignore[assignment]


def _debug_enabled() -> bool:
  return os.getenv("ANALYSIS_DEBUG", "0").lower() in ("1", "true", "yes", "on")


def _dbg(msg: str) -> None:
  if _debug_enabled():
    print(f"[DEBUG] {msg}")


def _patch_lcapy_select_iteration_bug() -> None:
  # Workaround per Python 3.13 + lcapy: OrderedDict mutated during iteration
  # in Netlist.select() / laplace().
  if Netlist is None:
    return
  if getattr(Netlist, "_dynamica_select_patched", False):
    return

  original_select = Netlist.select

  def _safe_select(self, kind):  # type: ignore[no-untyped-def]
    new = self._new()
    new.kind = kind
    # Snapshot esplicito per evitare mutazioni durante l'iterazione.
    for cpt in list(self._elements.values()):
      net = cpt._select(kind)
      new._add(net)
    return new

  Netlist.select = _safe_select  # type: ignore[method-assign]
  Netlist._dynamica_select_patched = True  # type: ignore[attr-defined]
  _dbg("Applied lcapy Netlist.select mutation workaround")


_patch_lcapy_select_iteration_bug()


def validate_circuit_integrity(components: list[CircuitComponent]) -> tuple[bool, str | None]:
  if len(components) == 0:
    return False, "Circuito vuoto: aggiungi almeno un componente."

  tolerance = 8.0
  tolerance2 = tolerance * tolerance
  clusters: list[tuple[float, float, int]] = []
  terminal_counts: dict[int, int] = defaultdict(int)
  cluster_components: dict[int, set[int]] = defaultdict(set)
  component_nodes: list[tuple[int, int]] = []

  def assign_cluster(x: float, y: float) -> int:
    for i, (cx, cy, count) in enumerate(clusters):
      if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= tolerance2:
        new_count = count + 1
        nx = (cx * count + x) / new_count
        ny = (cy * count + y) / new_count
        clusters[i] = (nx, ny, new_count)
        return i
    clusters.append((x, y, 1))
    return len(clusters) - 1

  for idx, comp in enumerate(components):
    a = assign_cluster(comp.pinA.x, comp.pinA.y)
    b = assign_cluster(comp.pinB.x, comp.pinB.y)
    component_nodes.append((a, b))
    terminal_counts[a] += 1
    terminal_counts[b] += 1
    cluster_components[a].add(idx)
    cluster_components[b].add(idx)

  dangling_components: list[str] = []
  for idx, (a, b) in enumerate(component_nodes):
    if terminal_counts[a] < 2 or terminal_counts[b] < 2:
      dangling_components.append(_canonical_label(components[idx], idx))
  if dangling_components:
    names = ", ".join(dangling_components[:4])
    suffix = "..." if len(dangling_components) > 4 else ""
    return False, f"Errore di integrita': componenti/rami scoperti ({names}{suffix})."

  adjacency: list[set[int]] = [set() for _ in components]
  for comp_ids in cluster_components.values():
    ids = list(comp_ids)
    for i in range(len(ids)):
      for j in range(i + 1, len(ids)):
        a = ids[i]
        b = ids[j]
        adjacency[a].add(b)
        adjacency[b].add(a)

  visited: set[int] = set()
  q = deque([0])
  visited.add(0)
  while q:
    cur = q.popleft()
    for nxt in adjacency[cur]:
      if nxt in visited:
        continue
      visited.add(nxt)
      q.append(nxt)

  if len(visited) != len(components):
    return False, "Errore di integrita': il circuito non e' completamente interconnesso."

  return True, None


def _canonical_label(comp: CircuitComponent, index: int) -> str:
  if comp.label and comp.label.strip():
    return comp.label.strip()
  return f"{comp.type.upper()}_{index + 1}"


def _safe_symbol(base: str, fallback: str) -> str:
  cleaned = "".join(ch for ch in base if ch.isalnum() or ch == "_")
  return cleaned or fallback


def _component_param_ok(comp: CircuitComponent, analysis_type: str) -> tuple[bool, str | None]:
  if comp.type in ("wire",):
    return True, None
  if comp.type in ("resistor", "capacitor", "inductor"):
    if not (comp.value and comp.value.strip()):
      return False, f"Parametro mancante per {comp.type} ({comp.id})"
    return True, None
  if comp.type == "voltage_source":
    if comp.voltageUnknown is True or not (comp.voltage and comp.voltage.strip()):
      return False, f"Tensione del generatore non nota ({comp.id})"
    return True, None
  if comp.type == "current_source":
    if comp.currentUnknown is True or not (comp.current and comp.current.strip()):
      return False, f"Corrente del generatore non nota ({comp.id})"
    return True, None
  return False, f"Tipo componente non supportato ({comp.id})"


def _build_graph(components: list[CircuitComponent]) -> tuple[list[str], list[dict[str, str]]]:
  # 1) Clustering geometrico dei nodi per tolleranza (riduce duplicati da jitter coordinate).
  tolerance = 8.0
  tolerance2 = tolerance * tolerance
  clusters: list[tuple[float, float, int]] = []

  def assign_cluster(x: float, y: float) -> int:
    for i, (cx, cy, count) in enumerate(clusters):
      if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= tolerance2:
        new_count = count + 1
        nx = (cx * count + x) / new_count
        ny = (cy * count + y) / new_count
        clusters[i] = (nx, ny, new_count)
        return i
    clusters.append((x, y, 1))
    return len(clusters) - 1

  raw_edges: list[dict[str, str]] = []
  for idx, comp in enumerate(components):
    a_idx = assign_cluster(comp.pinA.x, comp.pinA.y)
    b_idx = assign_cluster(comp.pinB.x, comp.pinB.y)
    raw_edges.append({
      "id": comp.id,
      "type": comp.type,
      "a": f"N{a_idx + 1}",
      "b": f"N{b_idx + 1}",
      "label": _canonical_label(comp, idx),
      "comp_idx": str(idx),
    })

  # 2) Contrazione dei rami wire: unione nodi collegati da fili ideali.
  nodes_all = sorted({e["a"] for e in raw_edges} | {e["b"] for e in raw_edges})
  parent = {n: n for n in nodes_all}

  def find(n: str) -> str:
    while parent[n] != n:
      parent[n] = parent[parent[n]]
      n = parent[n]
    return n

  def union(a: str, b: str) -> None:
    ra, rb = find(a), find(b)
    if ra != rb:
      parent[rb] = ra

  for e in raw_edges:
    if e["type"] == "wire":
      union(e["a"], e["b"])

  reduced_edges: list[dict[str, str]] = []
  for e in raw_edges:
    if e["type"] == "wire":
      continue
    a_rep, b_rep = find(e["a"]), find(e["b"])
    if a_rep == b_rep:
      # componente corto su stesso nodo dopo contrazione -> ignorato in questa versione
      continue
    reduced_edges.append({
      "id": e["id"],
      "type": e["type"],
      "a": a_rep,
      "b": b_rep,
      "label": e["label"],
      "comp_idx": e["comp_idx"],
    })

  # 3) Rinumerazione compatta N1..Nk dopo contrazione.
  used_nodes = sorted({e["a"] for e in reduced_edges} | {e["b"] for e in reduced_edges})
  node_ren = {old: f"N{i + 1}" for i, old in enumerate(used_nodes)}
  for e in reduced_edges:
    e["a"] = node_ren[e["a"]]
    e["b"] = node_ren[e["b"]]

  nodes = list(node_ren.values())
  return nodes, reduced_edges


def _tree_cotree(edges: list[dict[str, str]]) -> tuple[list[int], list[int]]:
  adjacency: dict[str, list[tuple[str, int]]] = {}
  for idx, e in enumerate(edges):
    adjacency.setdefault(e["a"], []).append((e["b"], idx))
    adjacency.setdefault(e["b"], []).append((e["a"], idx))

  visited_nodes: set[str] = set()
  used_edges: set[int] = set()
  tree: list[int] = []

  for node in adjacency:
    if node in visited_nodes:
      continue
    visited_nodes.add(node)
    q = deque([node])
    while q:
      cur = q.popleft()
      for nxt, edge_idx in adjacency.get(cur, []):
        if nxt in visited_nodes:
          continue
        visited_nodes.add(nxt)
        q.append(nxt)
        used_edges.add(edge_idx)
        tree.append(edge_idx)

  cotree = [i for i in range(len(edges)) if i not in used_edges]
  return tree, cotree


def _find_tree_path(
  start: str,
  end: str,
  edges: list[dict[str, str]],
  tree_set: set[int],
) -> list[tuple[int, int]]:
  adjacency: dict[str, list[tuple[str, int]]] = {}
  for idx, e in enumerate(edges):
    if idx not in tree_set:
      continue
    adjacency.setdefault(e["a"], []).append((e["b"], idx))
    adjacency.setdefault(e["b"], []).append((e["a"], idx))

  parent: dict[str, tuple[str, int]] = {}
  q = deque([start])
  visited = {start}

  while q:
    cur = q.popleft()
    if cur == end:
      break
    for nxt, edge_idx in adjacency.get(cur, []):
      if nxt in visited:
        continue
      visited.add(nxt)
      parent[nxt] = (cur, edge_idx)
      q.append(nxt)

  if end not in visited:
    return []

  # Path reconstructed from end to start.
  raw: list[tuple[str, str, int]] = []
  node = end
  while node != start:
    p, edge_idx = parent[node]
    raw.append((p, node, edge_idx))
    node = p
  raw.reverse()

  path: list[tuple[int, int]] = []
  for from_node, to_node, edge_idx in raw:
    e = edges[edge_idx]
    sign = 1 if (from_node == e["a"] and to_node == e["b"]) else -1
    path.append((edge_idx, sign))
  return path


def _impedance_symbol(comp: CircuitComponent) -> str:
  lbl = _safe_symbol(comp.label or comp.id, comp.id)
  if comp.type == "resistor":
    return lbl
  if comp.type == "inductor":
    return f"s{lbl}"
  if comp.type == "capacitor":
    return f"1/(s{lbl})"
  return "0"


def _source_voltage_drop(comp: CircuitComponent) -> str:
  # a_positive: traversando a->b si ha caduta +V.
  # b_positive: traversando a->b si ha caduta -V.
  v_sym = _safe_symbol(comp.voltage or comp.label or comp.id, comp.id)
  if comp.type == "voltage_source":
    return v_sym if comp.sourcePolarity != "b_positive" else f"-{v_sym}"
  return "0"


def _latex_system(lines: list[str]) -> str:
  return "\\begin{cases}\n" + " \\\\\n+".join(lines) + "\n\\end{cases}"

def _to_latex(expr: object) -> str:
  if hasattr(expr, "latex"):
    try:
      return str(expr.latex())  # type: ignore[attr-defined]
    except Exception:
      pass
  return str(expr)


def _latex_eq(lhs: object, rhs: object) -> str:
  # Evita che SymPy valuti Eq(...) a True/False durante la serializzazione.
  try:
    return sp.latex(sp.Eq(lhs, rhs, evaluate=False))
  except Exception:
    return f"{sp.latex(lhs)} = {sp.latex(rhs)}"


def _sanitize_value(raw: str | None) -> str:
  if not raw:
    return ""
  value = raw.strip().replace(",", ".")
  filtered = "".join(ch for ch in value if ch.isdigit() or ch in ".+-eE")
  return filtered


def _net_name(comp: CircuitComponent, edge_label: str, idx: int) -> str:
  label = _safe_symbol(edge_label, f"{comp.type}_{idx + 1}")
  if comp.type == "resistor":
    return f"R{label}" if not label.startswith("R") else label
  if comp.type == "capacitor":
    return f"C{label}" if not label.startswith("C") else label
  if comp.type == "inductor":
    return f"L{label}" if not label.startswith("L") else label
  if comp.type == "voltage_source":
    return f"V{label}" if not label.startswith("V") else label
  if comp.type == "current_source":
    return f"I{label}" if not label.startswith("I") else label
  return f"X{label}"


def _edge_value(comp: CircuitComponent) -> str:
  if comp.type in ("resistor", "capacitor", "inductor"):
    return _sanitize_value(comp.value)
  if comp.type == "voltage_source":
    return _sanitize_value(comp.voltage)
  if comp.type == "current_source":
    return _sanitize_value(comp.current)
  return ""


def _build_lcapy_netlist(edges: list[dict[str, str]], components: list[CircuitComponent]) -> str:
  lines: list[str] = []
  for idx, edge in enumerate(edges):
    comp = components[int(edge["comp_idx"])]
    value = _edge_value(comp)
    if value == "":
      raise ValueError(f"Valore non valido per {edge['label']}")
    name = _net_name(comp, edge["label"], idx)
    lines.append(f"{name} {edge['a']} {edge['b']} {value}")
  return "\n".join(lines)


def _set_reference_node(netlist: str, reference_node: str) -> str:
  # Per analisi nodale: imponiamo esplicitamente un nodo di riferimento (0)
  # rinominando il nodo scelto, senza aggiungere componenti fittizi.
  tokens = netlist.split()
  rewritten = ["0" if tok == reference_node else tok for tok in tokens]
  return " ".join(rewritten)


def _build_graph_svg(nodes: list[str], edges: list[dict[str, str]], tree: list[int], cotree: list[int]) -> str:
  if len(nodes) == 0:
    return '<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg"></svg>'

  import math

  cx, cy = 380.0, 180.0
  radius = 125.0 + max(0, (len(nodes) - 4)) * 14.0
  pos: dict[str, tuple[float, float]] = {}
  for i, n in enumerate(nodes):
    ang = (2.0 * math.pi * i / len(nodes)) - math.pi / 2.0
    pos[n] = (cx + radius * math.cos(ang), cy + radius * math.sin(ang))

  parts: list[str] = [
    '<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg">',
    '<defs>',
    '<marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">',
    '<path d="M0,0 L8,4 L0,8 Z" fill="#9dd8ff"/>',
    '</marker>',
    '</defs>',
    '<rect x="0" y="0" width="760" height="360" rx="14" fill="#091d3d" />',
  ]

  tree_set = set(tree)
  for idx, e in enumerate(edges):
    x1, y1 = pos[e["a"]]
    x2, y2 = pos[e["b"]]
    if idx in tree_set:
      stroke = "#a9dcff"
      dash = ""
      width = "2.8"
    else:
      stroke = "#bfd4ff"
      dash = 'stroke-dasharray="7 5"'
      width = "2.3"
    parts.append(
      f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{width}" {dash} marker-end="url(#arr)" />'
    )
    mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    parts.append(
      f'<text x="{mx + 8:.2f}" y="{my - 8:.2f}" fill="#eef6ff" font-size="13" font-family="Arial, sans-serif">{e["label"]}</text>'
    )

  for n in nodes:
    x, y = pos[n]
    parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="6" fill="#f5f8ff" />')
    parts.append(f'<text x="{x + 10:.2f}" y="{y - 10:.2f}" fill="#d9ebff" font-size="13" font-family="Arial, sans-serif">{n}</text>')

  parts.append("</svg>")
  return "".join(parts)


def _label_to_latex(label: str) -> str:
  if not label:
    return ""
  prefix = "".join(ch for ch in label if ch.isalpha())
  suffix = "".join(ch for ch in label if ch.isdigit())
  if prefix and suffix:
    return f"{prefix}_{{{suffix}}}"
  return label


def _incidence_matrix_latex(nodes: list[str], edges: list[dict[str, str]]) -> str:
  if not nodes or not edges:
    return ""
  # A[n, b] = +1 se il ramo esce dal nodo n, -1 se entra, 0 altrimenti.
  rows: list[list[int]] = [[0 for _ in edges] for _ in nodes]
  node_idx = {n: i for i, n in enumerate(nodes)}
  for b_idx, edge in enumerate(edges):
    a_idx = node_idx[edge["a"]]
    b_node_idx = node_idx[edge["b"]]
    rows[a_idx][b_idx] = 1
    rows[b_node_idx][b_idx] = -1

  col_labels = " & ".join(_label_to_latex(edge["label"]) for edge in edges)
  body_rows = []
  for r_idx, node in enumerate(nodes):
    vals = " & ".join(str(rows[r_idx][c_idx]) for c_idx in range(len(edges)))
    body_rows.append(f"{node} & {vals}")

  return (
    "\\begin{array}{c|"
    + "c" * len(edges)
    + "}\n"
    + " & "
    + col_labels
    + " \\\\\n\\hline\n"
    + " \\\\\n".join(body_rows)
    + "\n\\end{array}"
  )


def _mesh_matrix_latex(mesh_currents: list[str], edges: list[dict[str, str]], b_rows: list[list[int]]) -> str:
  if not mesh_currents or not edges or not b_rows:
    return ""
  col_labels = " & ".join(_label_to_latex(edge["label"]) for edge in edges)
  body_rows = []
  for r_idx, mesh_name in enumerate(mesh_currents):
    vals = " & ".join(str(b_rows[r_idx][c_idx]) for c_idx in range(len(edges)))
    body_rows.append(f"{mesh_name} & {vals}")
  return (
    "\\begin{array}{c|"
    + "c" * len(edges)
    + "}\n"
    + " & "
    + col_labels
    + " \\\\\n\\hline\n"
    + " \\\\\n".join(body_rows)
    + "\n\\end{array}"
  )


def _run_mesh(job_id: str, payload: AnalysisRequest) -> AnalysisResult:
  components = payload.circuit.components
  _dbg(f"[MESH] Input components count = {len(components)}")
  for c in components:
      _dbg(f"[MESH] Component: id={c.id}, type={c.type}, value={c.value}, V={getattr(c, 'voltage', None)}, I={getattr(c, 'current', None)}")
  nodes, edges = _build_graph(components)
  _dbg(f"[MESH] Nodes after clustering/contract = {nodes}")
  _dbg(f"[MESH] Edges after contraction = {edges}")
  if len(edges) == 0:
    raise ValueError("Dopo contrazione dei fili non restano bipoli analizzabili.")
  if Circuit is None:
    raise ValueError("Lcapy non installato. Esegui: pip install lcapy")

  netlist = _build_lcapy_netlist(edges, components)
  _dbg(f"mesh job={job_id} netlist=\n{netlist}")
  # Analisi diretta su netlist (senza trasformazione globale Laplace).
  # Per il metodo a maglie non serve imporre massa.
  with warnings.catch_warnings():
    warnings.filterwarnings("ignore", message=r"Ground node not specified.*", category=UserWarning)
    cct = Circuit(netlist)
  mesh = cct.mesh_analysis()
  _dbg(f"[MESH] Lcapy unknowns = {mesh.unknowns}")
  try:
    matrix_eq_obj = mesh.matrix_equations(form="A y = b")
  except RuntimeError:
    _dbg("RuntimeError in mesh.matrix_equations(form='A y = b')")
    _dbg(traceback.format_exc())
    matrix_eq_obj = "Matrix equation not available (runtime mutation error)"
  _dbg(f"[MESH] matrix_eq_obj raw = {matrix_eq_obj}")

  tree, cotree = _tree_cotree(edges)
  if len(cotree) == 0:
    raise ValueError("Nessuna maglia fondamentale trovata (grafo senza coalbero).")

  mesh_currents = [f"I_{k+1}" for k in range(len(cotree))]
  loops: list[dict[str, object]] = []
  # B[l][b] = coeff orientazione ramo b nella maglia l
  B: list[list[int]] = [[0 for _ in edges] for _ in cotree]

  for l_idx, cotree_edge_idx in enumerate(cotree):
    ce = edges[cotree_edge_idx]
    # Direzione maglia fissata sul ramo di coalbero a->b.
    path = _find_tree_path(ce["b"], ce["a"], edges, set(tree))
    B[l_idx][cotree_edge_idx] = 1
    for e_idx, sign in path:
      B[l_idx][e_idx] = sign
    loops.append({
      "mesh": mesh_currents[l_idx],
      "cotree_edge": ce["id"],
      "branches": [edges[cotree_edge_idx]["label"]] + [edges[idx]["label"] for idx, _ in path],
    })
  _dbg(f"[MESH] Tree edges indices = {tree}")
  _dbg(f"[MESH] Cotree edges indices = {cotree}")
  _dbg(f"[MESH] Incidence matrix B = {B}")
  _dbg(f"[MESH] Fundamental loops = {loops}")

  # Equazioni e risoluzione da Lcapy/SymPy.
  unknown_syms = []
  for u in mesh.unknowns:
    unknown_syms.append(u.sympy if hasattr(u, "sympy") else sp.Symbol(str(u)))
  mesh_currents = [str(u) for u in unknown_syms] if unknown_syms else mesh_currents

  if not hasattr(matrix_eq_obj, "lhs") or not hasattr(matrix_eq_obj, "rhs"):
    raise ValueError(f"Lcapy non ha prodotto una forma matriciale valida: {matrix_eq_obj}")

  lhs_sym = matrix_eq_obj.lhs.sympy if hasattr(matrix_eq_obj.lhs, "sympy") else matrix_eq_obj.lhs
  rhs_sym = matrix_eq_obj.rhs.sympy if hasattr(matrix_eq_obj.rhs, "sympy") else matrix_eq_obj.rhs
  lhs_mat = lhs_sym.as_explicit() if hasattr(lhs_sym, "as_explicit") else sp.Matrix(lhs_sym)
  rhs_mat = rhs_sym.as_explicit() if hasattr(rhs_sym, "as_explicit") else sp.Matrix(rhs_sym)
  _dbg(f"[MESH] lhs_mat = {lhs_mat}")
  _dbg(f"[MESH] rhs_mat = {rhs_mat}")
  eq_mat = lhs_mat - rhs_mat
  _dbg(f"[MESH] eq_mat (lhs - rhs) = {eq_mat}")

  # Costruzione robusta delle espressioni poste a zero (evita BooleanTrue/False)
  exprs = []
  for i in range(eq_mat.rows):
      expr = sp.simplify(eq_mat[i, 0])

      # Ignora identità 0 = 0
      if expr == 0:
          continue

      # Gestione esplicita booleani SymPy
      if expr is sp.S.true:
          continue
      if expr is sp.S.false:
          raise ValueError("Sistema inconsistente: equazione impossibile.")

      exprs.append(expr)
  _dbg(f"[MESH] Filtered expressions (Ax - b = 0 form) = {exprs}")

  if not exprs:
      raise ValueError("Sistema degenere: nessuna equazione valida (tutte identità).")

  A, b = sp.linear_eq_to_matrix(exprs, unknown_syms)
  _dbg(f"[MESH] Matrix A = {A}")
  _dbg(f"[MESH] Vector b = {b}")

  sol_set = sp.linsolve((A, b), unknown_syms)
  sol_tuple = next(iter(sol_set), tuple())
  sol_map = {unknown_syms[i]: sol_tuple[i] for i in range(min(len(unknown_syms), len(sol_tuple)))}
  _dbg(f"[MESH] Solution set = {sol_set}")
  _dbg(f"[MESH] Solution map = {sol_map}")

  equations = [_latex_eq(expr, 0) for expr in exprs]

  if not equations:
      equations = []

  # Relazioni correnti di ramo = combinazioni lineari correnti di maglia.
  branch_relations_latex: list[str] = []
  branch_currents: list[str] = []
  power_table_rows: list[str] = []
  power_terms: list[sp.Expr] = []
  power_unknown_count = 0

  for b_idx, edge in enumerate(edges):
    comp = components[int(edge["comp_idx"])]
    if comp.type == "wire":
      continue
    expr = sp.Integer(0)
    for l in range(len(cotree)):
      if l >= len(unknown_syms):
        continue
      s = B[l][b_idx]
      if s == 0:
        continue
      expr += sp.Integer(s) * unknown_syms[l]
    label_sym = _safe_symbol(edge["label"], edge["id"])
    branch_relations_latex.append(_latex_eq(sp.Symbol(f"I_{label_sym}"), expr))

    expr_eval = sp.simplify(expr.subs(sol_map))
    branch_currents.append(f"I_{{{label_sym}}} = {sp.latex(expr_eval)}")

    # Tabella I, V, P (P=0 W per passivi come da richiesta).
    if comp.type in ("resistor", "capacitor", "inductor"):
      z_val = _sanitize_value(comp.value)
      i_text = sp.latex(expr_eval)
      v_expr = sp.simplify(sp.sympify(z_val) * expr_eval) if z_val else sp.Integer(0)
      v_text = sp.latex(v_expr)
      p_expr = sp.simplify(v_expr * expr_eval)
      p_text = sp.latex(p_expr) + "\\,\\mathrm{W}"
      power_terms.append(p_expr)
    elif comp.type == "voltage_source":
      v_raw = _sanitize_value(comp.voltage)
      v_text = sp.latex(sp.sympify(v_raw)) if v_raw else "0"
      i_text = sp.latex(expr_eval)
      p_expr = sp.simplify(sp.sympify(v_raw) * expr_eval) if v_raw else sp.Integer(0)
      p_text = sp.latex(p_expr) + "\\,\\mathrm{W}"
      power_terms.append(p_expr)
    else:  # current_source
      i_raw = _sanitize_value(comp.current)
      i_text = sp.latex(sp.sympify(i_raw)) if i_raw else sp.latex(expr_eval)
      v_text = "?"
      p_text = "?\\,\\mathrm{W}"
      power_unknown_count += 1
    power_table_rows.append(f"{_label_to_latex(edge['label'])}|{i_text}|{v_text}|{p_text}")

  p_balance_latex = "\\text{Bilancio non disponibile}"
  if power_terms:
    total_power = sp.simplify(sum(power_terms, sp.Integer(0)))
    entering = sp.Integer(0)
    exiting = sp.Integer(0)
    numeric_ok = True
    for term in power_terms:
      term_val = sp.N(term)
      if not (term_val.is_real is True):
        numeric_ok = False
        break
      try:
        term_float = float(term_val)
      except Exception:
        numeric_ok = False
        break
      if term_float >= 0:
        entering += sp.Abs(term)
      else:
        exiting += sp.Abs(term)
    is_balanced = bool(power_unknown_count == 0 and sp.simplify(total_power) == 0)
    balance_phrase = "\\text{Il circuito " + ("e' energeticamente bilanciato" if is_balanced else "non e' energeticamente bilanciato") + "}"
    if numeric_ok:
      p_balance_latex = (
        "\\sum P_{entrante}=" + sp.latex(sp.simplify(entering)) + "\\,\\mathrm{W}"
        + ",\\quad "
        + "\\sum P_{uscente}=" + sp.latex(sp.simplify(exiting)) + "\\,\\mathrm{W}"
        + ",\\quad "
        + "\\sum P=" + sp.latex(total_power) + "\\,\\mathrm{W}"
        + ",\\quad "
        + balance_phrase
        + ("\\quad\\text{(attenzione: presenti }" + str(power_unknown_count) + "\\text{ potenze ignote)}" if power_unknown_count > 0 else "")
      )
    else:
      p_balance_latex = (
        "\\sum P=" + sp.latex(total_power) + "\\,\\mathrm{W}"
        + ",\\quad "
        + "\\sum P_{entrante}=\\text{n/d},\\quad \\sum P_{uscente}=\\text{n/d}"
        + ",\\quad "
        + balance_phrase
        + ("\\quad\\text{(attenzione: presenti }" + str(power_unknown_count) + "\\text{ potenze ignote)}" if power_unknown_count > 0 else "")
      )

  matrix_latex = (
    sp.latex(A) + "\\cdot" + sp.latex(sp.Matrix(unknown_syms)) + "=" + sp.latex(b)
  )
  sol_latex_lines = [_latex_eq(u, sol_map[u]) for u in unknown_syms if u in sol_map]
  scalar_lines = "\\\\\n".join([_latex_eq(expr, 0) for expr in exprs]) or "\\text{Nessuna equazione}"
  solution_lines = "\\\\\n".join([_latex_eq(u, sol_map[u]) for u in unknown_syms if u in sol_map]) or "\\text{Nessuna soluzione}"
  branch_lines = "\\\\\n".join(branch_relations_latex) or "\\text{Nessuna relazione}"
  matrix_lines = matrix_latex
  analysis_steps = [
    "1) Costruzione equazione di maglia (LKT)||" + scalar_lines.replace("\\\\\n", "%%"),
    "2) Forma matriciale||" + matrix_lines.replace("\\\\\n", "%%"),
    "3) Risoluzione del sistema||" + solution_lines.replace("\\\\\n", "%%"),
    "4) Correnti di ramo||" + branch_lines.replace("\\\\\n", "%%"),
  ]
  graph_notes = [
    f"Maglie fondamentali: {len(cotree)}",
    "Supermaglie: non rilevate automaticamente in questa versione.",
    "Ogni maglia fondamentale nasce da un ramo di coalbero.",
    "I versi di maglia sono assegnati automaticamente.",
  ]

  def _as_aligned_block(block: str) -> str:
    return block.replace("\\\\\n", "\\\\\n&")

  latex = (
      "\\begin{aligned}\n"
      + "&\\textbf{1) Costruzione equazione di maglia (LKT)}\\\\\n"
      + "&" + _as_aligned_block(scalar_lines)
      + "\\\\[8pt]\n"
      + "&\\textbf{2) Forma matriciale}\\\\\n"
      + "&" + _as_aligned_block(matrix_lines)
      + "\\\\[8pt]\n"
      + "&\\textbf{3) Risoluzione del sistema}\\\\\n"
      + "&" + _as_aligned_block(solution_lines)
      + "\\\\[8pt]\n"
      + "&\\textbf{4) Correnti di ramo}\\\\\n"
      + "&" + _as_aligned_block(branch_lines)
      + "\n\\end{aligned}"
  )

  graph_info: dict[str, str | int | float | bool | list[str]] = {
    "nodes_count": len(nodes),
    "branches_count": len(edges),
    "nodes": nodes,
    "tree_edges": [edges[i]["label"] for i in tree],
    "cotree_edges": [edges[i]["label"] for i in cotree],
    "mesh_currents": mesh_currents,
    "lkt_system_latex": equations,
    "matrix_form_latex": matrix_latex,
    "mesh_solution_latex": sol_latex_lines,
    "branch_relations_latex": branch_relations_latex,
    "analysis_steps": analysis_steps,
    "graph_notes": graph_notes,
    "B_matrix_latex": _mesh_matrix_latex(mesh_currents, edges, B),
    "fundamental_loops": [f"{loop['mesh']}: " + ", ".join(loop["branches"]) for loop in loops],  # type: ignore[arg-type]
    "branch_currents": branch_currents,
    "power_table_rows": power_table_rows,
    "power_balance_latex": p_balance_latex,
    "graph_svg": _build_graph_svg(nodes, edges, tree, cotree),
    "incidence_matrix_latex": _incidence_matrix_latex(nodes, edges),
  }

  return AnalysisResult(
    job_id=job_id,
    analysis_type="mesh",
    latex=latex,
    equations=equations,
    summary={
      "message": "Analisi alle maglie completata",
      "components": len(components),
      "fundamental_loops": len(cotree),
    },
    graph_info=graph_info,
  )


def _run_nodal(job_id: str, payload: AnalysisRequest) -> AnalysisResult:
  components = payload.circuit.components
  nodes, edges = _build_graph(components)
  if len(edges) == 0:
    raise ValueError("Dopo contrazione dei fili non restano bipoli analizzabili.")
  if Circuit is None:
    raise ValueError("Lcapy non installato. Esegui: pip install lcapy")

  netlist = _build_lcapy_netlist(edges, components)
  # In nodale serve un riferimento: usiamo il primo nodo come massa.
  ref_node = edges[0]["a"]
  netlist = _set_reference_node(netlist, ref_node)
  _dbg(f"nodal job={job_id} ref_node={ref_node} netlist=\n{netlist}")
  cct = Circuit(netlist)
  nodal = cct.nodal_analysis()
  try:
    matrix_eq_obj = cct.matrix_equations(form="A y = b")
  except RuntimeError:
    _dbg("RuntimeError in cct.matrix_equations(form='A y = b')")
    _dbg(traceback.format_exc())
    matrix_eq_obj = "Matrix equation not available (runtime mutation error)"

  equations = []
  try:
    nodal_eq_obj = nodal.nodal_equations()
    if isinstance(nodal_eq_obj, dict):
      equations = [f"{k}: {v}" for k, v in nodal_eq_obj.items()]
    elif isinstance(nodal_eq_obj, (list, tuple, set)):
      equations = [str(x) for x in nodal_eq_obj]
    else:
      equations = [str(nodal_eq_obj)]
  except RuntimeError:
    _dbg("RuntimeError in nodal.nodal_equations()")
    _dbg(traceback.format_exc())
    equations = [str(nodal)]
  latex = (
    "\\begin{aligned}\n"
    "\\textbf{Analisi nodale (Lcapy)}\\\\\n"
    "\\text{Netlist ridotta: }\\texttt{"
    + netlist.replace("\n", "\\\\")
    + "}\\\\[6pt]\n"
    + _to_latex(matrix_eq_obj)
    + "\n\\end{aligned}"
  )

  return AnalysisResult(
    job_id=job_id,
    analysis_type="nodal",
    latex=latex,
    equations=equations,
    summary={
      "message": "Analisi nodale completata",
      "components": len(components),
      "nodes": len(nodes),
    },
    graph_info={
      "nodes_count": len(nodes),
      "branches_count": len(edges),
      "nodes": nodes,
      "branches": [f"{e['label']}:{e['a']}->{e['b']}" for e in edges],
      "graph_svg": _build_graph_svg(nodes, edges, [], list(range(len(edges)))),
      "incidence_matrix_latex": _incidence_matrix_latex(nodes, edges),
    },
  )


def run_analysis(job_id: str, payload: AnalysisRequest) -> AnalysisResult:
  """Validate payload and dispatch to the selected analysis algorithm."""
  _dbg(f"run_analysis start job={job_id} type={payload.analysis_type} components={len(payload.circuit.components)}")
  components = payload.circuit.components
  for idx, comp in enumerate(components):
    _dbg(
      "[PAYLOAD] "
      + f"#{idx+1} id={comp.id} type={comp.type} label={comp.label} "
      + f"pinA=({comp.pinA.x},{comp.pinA.y}) pinB=({comp.pinB.x},{comp.pinB.y}) "
      + f"value={comp.value} "
      + f"current={comp.current} currentUnknown={comp.currentUnknown} "
      + f"voltage={comp.voltage} voltageUnknown={comp.voltageUnknown} "
      + f"sourceDirection={comp.sourceDirection} sourcePolarity={comp.sourcePolarity}"
    )
  if len(components) == 0:
    raise ValueError("Circuito vuoto: impossibile eseguire analisi.")

  is_integrity_ok, integrity_error = validate_circuit_integrity(components)
  if not is_integrity_ok:
    raise ValueError(integrity_error or "Errore di integrita' del circuito.")

  for comp in components:
    ok, error = _component_param_ok(comp, payload.analysis_type)
    if not ok:
      raise ValueError(error or "Parametri non validi per analisi.")

  if payload.analysis_type == "mesh":
    from app.core.mesh_analysis import run_mesh_analysis

    result = run_mesh_analysis(job_id, payload)
    _dbg(f"run_analysis completed job={job_id} type=mesh")
    return result
  result = _run_nodal(job_id, payload)
  _dbg(f"run_analysis completed job={job_id} type=nodal")
  return result
