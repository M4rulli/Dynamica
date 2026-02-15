"""
Mesh-analysis algorithm implementation.

This file contains the method-specific pipeline for loop analysis:
- fundamental loop extraction,
- KVL system assembly,
- current-source constraints / supermesh handling,
- symbolic solve and report material generation.
"""

import sympy as sp

from app.core.models import AnalysisRequest, AnalysisResult
from app.core.analysis_common import (
  build_graph,
  build_graph_svg,
  find_tree_path,
  incidence_matrix_latex,
  label_to_latex,
  latex_eq,
  mesh_matrix_latex,
  sanitize_value,
  tree_cotree,
)

def run_mesh_analysis(job_id: str, payload: AnalysisRequest) -> AnalysisResult:
  """Run full mesh analysis and return a normalized `AnalysisResult` payload."""
  components = payload.circuit.components
  nodes, edges = build_graph(components)
  if len(edges) == 0:
    raise ValueError("Dopo contrazione dei fili non restano bipoli analizzabili.")

  tree, cotree = tree_cotree(edges)
  if len(cotree) == 0:
    raise ValueError("Nessuna maglia fondamentale trovata (grafo senza coalbero).")

  mesh_syms = [sp.Symbol(f"I_{i+1}") for i in range(len(cotree))]
  mesh_currents = [str(s) for s in mesh_syms]
  b_matrix: list[list[int]] = [[0 for _ in edges] for _ in cotree]
  loops: list[list[int]] = []
  tree_set = set(tree)

  for li, cotree_idx in enumerate(cotree):
    ce = edges[cotree_idx]
    path = find_tree_path(ce["b"], ce["a"], edges, tree_set)
    b_matrix[li][cotree_idx] = 1
    loop_edges = [cotree_idx]
    for e_idx, sign in path:
      b_matrix[li][e_idx] = sign
      loop_edges.append(e_idx)
    loops.append(loop_edges)

  def branch_current_expr(branch_idx: int) -> sp.Expr:
    expr = sp.Integer(0)
    for li in range(len(cotree)):
      s = b_matrix[li][branch_idx]
      if s != 0:
        expr += sp.Integer(s) * mesh_syms[li]
    return sp.simplify(expr)

  def parse_symbolic_value(raw: str | None, fallback: str) -> sp.Expr:
    val = sanitize_value(raw)
    if val:
      try:
        return sp.sympify(val)
      except Exception:
        pass
    return sp.Symbol(fallback)

  kvl_exprs: list[sp.Expr] = []
  aux_voltage_symbols: dict[int, sp.Symbol] = {}
  graph_notes: list[str] = []

  for li in range(len(cotree)):
    expr = sp.Integer(0)
    for bi in range(len(edges)):
      s = b_matrix[li][bi]
      if s == 0:
        continue
      edge = edges[bi]
      comp = components[int(edge["comp_idx"])]
      i_branch = branch_current_expr(bi)

      if comp.type == "resistor":
        r = parse_symbolic_value(comp.value, edge["label"])
        expr += sp.Integer(s) * r * i_branch
      elif comp.type == "inductor":
        l = parse_symbolic_value(comp.value, edge["label"])
        expr += sp.Integer(s) * sp.Symbol("s") * l * i_branch
      elif comp.type == "capacitor":
        c = parse_symbolic_value(comp.value, edge["label"])
        expr += sp.Integer(s) * (1 / (sp.Symbol("s") * c)) * i_branch
      elif comp.type == "voltage_source":
        v = parse_symbolic_value(comp.voltage, edge["label"])
        vdrop = v if comp.sourcePolarity != "b_positive" else -v
        expr += sp.Integer(s) * vdrop
      elif comp.type == "current_source":
        # Supermaglia support: tensione del generatore di corrente come ausiliaria.
        v_aux = aux_voltage_symbols.get(bi)
        if v_aux is None:
          v_aux = sp.Symbol(f"V_{edge['label']}")
          aux_voltage_symbols[bi] = v_aux
        expr += sp.Integer(s) * v_aux
    kvl_exprs.append(sp.simplify(expr))

  constraints: list[sp.Expr] = []
  supermesh_count = 0
  for bi, edge in enumerate(edges):
    comp = components[int(edge["comp_idx"])]
    if comp.type != "current_source":
      continue
    i0 = parse_symbolic_value(comp.current, edge["label"])
    rhs = i0 if comp.sourceDirection != "b_to_a" else -i0
    i_branch = branch_current_expr(bi)
    constraints.append(sp.simplify(i_branch - rhs))
    memberships = [li for li in range(len(cotree)) if b_matrix[li][bi] != 0]
    if bi in cotree and len(memberships) >= 2:
      supermesh_count += 1

  unknowns: list[sp.Symbol] = mesh_syms + list(aux_voltage_symbols.values())
  all_exprs = kvl_exprs + constraints
  if len(all_exprs) == 0:
    raise ValueError("Nessuna equazione disponibile per il metodo alle maglie.")

  eq_latex = [latex_eq(e, 0) for e in all_exprs]
  A, b = sp.linear_eq_to_matrix(all_exprs, unknowns)
  sol_set = sp.linsolve((A, b), unknowns)
  sol_tuple = next(iter(sol_set), tuple())
  sol_map = {unknowns[i]: sol_tuple[i] for i in range(min(len(unknowns), len(sol_tuple)))}

  branch_relations_latex: list[str] = []
  power_table_rows: list[str] = []
  power_terms: list[sp.Expr] = []
  power_unknown_count = 0

  for bi, edge in enumerate(edges):
    comp = components[int(edge["comp_idx"])]
    i_expr = branch_current_expr(bi)
    label_sym = edge["label"]
    branch_relations_latex.append(latex_eq(sp.Symbol(f"I_{label_sym}"), i_expr))
    i_eval = sp.simplify(i_expr.subs(sol_map))
    i_text = sp.latex(i_eval)

    if comp.type in ("resistor", "inductor", "capacitor"):
      z = parse_symbolic_value(comp.value, label_sym)
      if comp.type == "inductor":
        z = sp.Symbol("s") * z
      if comp.type == "capacitor":
        z = 1 / (sp.Symbol("s") * z)
      v_eval = sp.simplify(z * i_eval)
      p_eval = sp.simplify(v_eval * i_eval)
      v_text = sp.latex(v_eval)
      p_text = sp.latex(p_eval) + "\\,\\mathrm{W}"
      power_terms.append(p_eval)
    elif comp.type == "voltage_source":
      v = parse_symbolic_value(comp.voltage, label_sym)
      v_eval = v if comp.sourcePolarity != "b_positive" else -v
      p_eval = sp.simplify(v_eval * i_eval)
      v_text = sp.latex(v_eval)
      p_text = sp.latex(p_eval) + "\\,\\mathrm{W}"
      power_terms.append(p_eval)
    else:
      # current source: usa la tensione ausiliaria, se disponibile
      v_aux = aux_voltage_symbols.get(bi)
      if v_aux and v_aux in sol_map:
        v_eval = sp.simplify(sol_map[v_aux])
        p_eval = sp.simplify(v_eval * i_eval)
        v_text = sp.latex(v_eval)
        p_text = sp.latex(p_eval) + "\\,\\mathrm{W}"
        power_terms.append(p_eval)
      else:
        v_text = "?"
        p_text = "?\\,\\mathrm{W}"
        power_unknown_count += 1

    power_table_rows.append(f"{label_to_latex(label_sym)}|{i_text}|{v_text}|{p_text}")

  total_power = sp.simplify(sum(power_terms, sp.Integer(0))) if power_terms else sp.Integer(0)
  entering: sp.Expr | None = sp.Integer(0)
  exiting: sp.Expr | None = sp.Integer(0)
  numeric_signs = True
  for t in power_terms:
    try:
      tv = float(sp.N(t))
      if tv >= 0:
        entering += sp.Abs(t)
      else:
        exiting += sp.Abs(t)
    except Exception:
      numeric_signs = False
  if not numeric_signs:
    entering = None
    exiting = None
  is_balanced = bool(power_unknown_count == 0 and sp.simplify(total_power) == 0)
  balance_phrase = "\\text{Il circuito " + ("e' energeticamente bilanciato" if is_balanced else "non e' energeticamente bilanciato") + "}"
  p_balance_latex = (
    "\\sum P_{entrante}=" + (sp.latex(entering) + "\\,\\mathrm{W}" if entering is not None else "\\text{n/d}") + ",\\quad "
    + "\\sum P_{uscente}=" + (sp.latex(exiting) + "\\,\\mathrm{W}" if exiting is not None else "\\text{n/d}") + ",\\quad "
    + "\\sum P=" + sp.latex(total_power) + "\\,\\mathrm{W},\\quad "
    + balance_phrase
    + ("\\quad\\text{(attenzione: presenti }" + str(power_unknown_count) + "\\text{ potenze ignote)}" if power_unknown_count > 0 else "")
  )

  matrix_latex = sp.latex(A) + "\\cdot" + sp.latex(sp.Matrix(unknowns)) + "=" + sp.latex(b)
  solution_latex = [latex_eq(u, sol_map[u]) for u in unknowns if u in sol_map]
  analysis_steps = [
    "1) Costruzione equazione di maglia (LKT)||" + "\\\\\n".join([latex_eq(e, 0) for e in kvl_exprs]).replace("\\\\\n", "%%"),
    "2) Vincoli generatori di corrente / supermaglie||" + ("\\\\\n".join([latex_eq(e, 0) for e in constraints]).replace("\\\\\n", "%%") if constraints else "\\text{Nessun vincolo}"),
    "3) Forma matriciale||" + matrix_latex,
    "4) Risoluzione del sistema||" + ("\\\\\n".join(solution_latex).replace("\\\\\n", "%%") if solution_latex else "\\text{Nessuna soluzione}"),
    "5) Correnti di ramo||" + ("\\\\\n".join(branch_relations_latex).replace("\\\\\n", "%%") if branch_relations_latex else "\\text{Nessuna relazione}"),
  ]

  graph_notes = [
    f"Maglie fondamentali: {len(cotree)}",
    f"Vincoli da generatori di corrente: {len(constraints)}",
    f"Supermaglie rilevate: {supermesh_count}",
    "I versi di maglia sono assegnati automaticamente.",
  ]

  return AnalysisResult(
    job_id=job_id,
    analysis_type="mesh",
    latex="\\text{Output generato da mesh\\_analysis.py}",
    equations=eq_latex,
    summary={
      "message": "Analisi alle maglie completata",
      "components": len(components),
      "fundamental_loops": len(cotree),
      "constraints": len(constraints),
      "supermeshes": supermesh_count,
    },
    graph_info={
      "nodes_count": len(nodes),
      "branches_count": len(edges),
      "nodes": nodes,
      "tree_edges": [edges[i]["label"] for i in tree],
      "cotree_edges": [edges[i]["label"] for i in cotree],
      "mesh_currents": mesh_currents,
      "analysis_steps": analysis_steps,
      "B_matrix_latex": mesh_matrix_latex(mesh_currents, edges, b_matrix),
      "power_table_rows": power_table_rows,
      "power_balance_latex": p_balance_latex,
      "graph_svg": build_graph_svg(nodes, edges, tree, cotree),
      "incidence_matrix_latex": incidence_matrix_latex(nodes, edges),
      "graph_notes": graph_notes,
    },
  )
