"""
Shared backend utilities used by multiple analysis algorithms.

This module stores reusable, algorithm-agnostic helpers:
- graph extraction from geometric pins,
- tree/cotree traversal utilities,
- LaTeX formatting helpers,
- compact SVG graph rendering for report pages.
"""

from collections import deque

import sympy as sp

from app.core.models import CircuitComponent


def canonical_label(comp: CircuitComponent, index: int) -> str:
  if comp.label and comp.label.strip():
    return comp.label.strip()
  return f"{comp.type.upper()}_{index + 1}"


def safe_symbol(base: str, fallback: str) -> str:
  cleaned = "".join(ch for ch in base if ch.isalnum() or ch == "_")
  return cleaned or fallback


def build_graph(components: list[CircuitComponent]) -> tuple[list[str], list[dict[str, str]]]:
  """Collapse geometric pins into nodes and remove ideal wires via contraction."""
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
      "label": canonical_label(comp, idx),
      "comp_idx": str(idx),
    })

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
      continue
    reduced_edges.append({
      "id": e["id"],
      "type": e["type"],
      "a": a_rep,
      "b": b_rep,
      "label": e["label"],
      "comp_idx": e["comp_idx"],
    })

  used_nodes = sorted({e["a"] for e in reduced_edges} | {e["b"] for e in reduced_edges})
  node_ren = {old: f"N{i + 1}" for i, old in enumerate(used_nodes)}
  for e in reduced_edges:
    e["a"] = node_ren[e["a"]]
    e["b"] = node_ren[e["b"]]

  nodes = list(node_ren.values())
  return nodes, reduced_edges


def tree_cotree(edges: list[dict[str, str]]) -> tuple[list[int], list[int]]:
  """Compute a spanning-tree edge set and the complementary cotree set."""
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


def find_tree_path(start: str, end: str, edges: list[dict[str, str]], tree_set: set[int]) -> list[tuple[int, int]]:
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


def latex_eq(lhs: object, rhs: object) -> str:
  try:
    return sp.latex(sp.Eq(lhs, rhs, evaluate=False))
  except Exception:
    return f"{sp.latex(lhs)} = {sp.latex(rhs)}"


def sanitize_value(raw: str | None) -> str:
  if not raw:
    return ""
  value = raw.strip().replace(",", ".")
  filtered = "".join(ch for ch in value if ch.isdigit() or ch in ".+-eE")
  return filtered


def label_to_latex(label: str) -> str:
  if not label:
    return ""
  prefix = "".join(ch for ch in label if ch.isalpha())
  suffix = "".join(ch for ch in label if ch.isdigit())
  if prefix and suffix:
    return f"{prefix}_{{{suffix}}}"
  return label


def incidence_matrix_latex(nodes: list[str], edges: list[dict[str, str]]) -> str:
  if not nodes or not edges:
    return ""
  rows: list[list[int]] = [[0 for _ in edges] for _ in nodes]
  node_idx = {n: i for i, n in enumerate(nodes)}
  for b_idx, edge in enumerate(edges):
    a_idx = node_idx[edge["a"]]
    b_node_idx = node_idx[edge["b"]]
    rows[a_idx][b_idx] = 1
    rows[b_node_idx][b_idx] = -1

  col_labels = " & ".join(label_to_latex(edge["label"]) for edge in edges)
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


def mesh_matrix_latex(mesh_currents: list[str], edges: list[dict[str, str]], b_rows: list[list[int]]) -> str:
  if not mesh_currents or not edges or not b_rows:
    return ""
  col_labels = " & ".join(label_to_latex(edge["label"]) for edge in edges)
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


def build_graph_svg(nodes: list[str], edges: list[dict[str, str]], tree: list[int], cotree: list[int]) -> str:
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
