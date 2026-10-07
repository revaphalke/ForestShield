#ifndef FORESTSHIELD_GRAPH_CONFIG_H
#define FORESTSHIELD_GRAPH_CONFIG_H

/* Generated from config/forest-graph.json. Do not edit by hand. */
#define FS_CAUTION_MULT 2.8
#define FS_WALK_MPS 1.15
#define FS_SPREAD_CELLS_PER_10_MIN 2
#define FS_WIND_BIAS_SCALE 0.75
#define FS_SLOPE_BIAS_SCALE 0.35
#define FS_MAX_GRID_SIZE 3
#define FS_MAX_CELLS 9
#define FS_MAX_EDGES 16
#define FS_MAX_BLOCKED_EDGES 34
#define FS_MAX_PQ 72

typedef struct { int u; int v; double weight; } FsRawEdge;
typedef struct { int grid_size; int edge_count; const FsRawEdge *edges; int exit_count; const int *exits; const double *exit_weights; } FsForestConfig;

static const FsRawEdge FS_EDGES_MIYAWAKI[] = {
  {0, 1, 70},
  {1, 2, 76},
  {0, 3, 82},
  {1, 4, 68},
  {2, 5, 84},
  {3, 4, 58},
  {4, 5, 74},
  {3, 6, 88},
  {4, 7, 54},
  {5, 8, 80},
  {6, 7, 72},
  {7, 8, 78},
  {0, 4, 96},
  {2, 4, 100},
  {3, 7, 94},
  {5, 7, 98},
};
static const int FS_EXITS_MIYAWAKI[] = {0, 2, 6, 8};
static const double FS_EXIT_WEIGHTS_MIYAWAKI[] = {26, 26, 26, 26};

static const FsRawEdge FS_EDGES_ANANDVAN[] = {
  {0, 1, 74},
  {1, 2, 74},
  {0, 3, 70},
  {1, 4, 110},
  {2, 5, 72},
  {3, 4, 108},
  {4, 5, 70},
  {3, 6, 72},
  {4, 7, 112},
  {5, 8, 74},
  {6, 7, 76},
  {7, 8, 76},
  {0, 4, 120},
  {2, 4, 90},
  {3, 7, 118},
  {5, 7, 92},
};
static const int FS_EXITS_ANANDVAN[] = {0, 2, 6, 8};
static const double FS_EXIT_WEIGHTS_ANANDVAN[] = {26, 26, 26, 26};

static const FsRawEdge FS_EDGES_BANER[] = {
  {0, 1, 64},
  {1, 2, 64},
  {0, 3, 96},
  {1, 4, 100},
  {2, 5, 98},
  {3, 4, 66},
  {4, 5, 68},
  {3, 6, 102},
  {4, 7, 108},
  {5, 8, 100},
  {6, 7, 70},
  {7, 8, 68},
  {0, 4, 110},
  {2, 4, 112},
  {3, 7, 114},
  {5, 7, 116},
};
static const int FS_EXITS_BANER[] = {0, 2, 6, 8};
static const double FS_EXIT_WEIGHTS_BANER[] = {26, 26, 26, 26};

static const FsRawEdge FS_EDGES_TAMHINI[] = {
  {0, 1, 80},
  {1, 2, 82},
  {0, 3, 70},
  {1, 4, 118},
  {2, 5, 72},
  {3, 4, 122},
  {4, 5, 120},
  {3, 6, 74},
  {4, 7, 116},
  {5, 8, 76},
  {6, 7, 78},
  {7, 8, 80},
  {0, 4, 108},
  {2, 4, 110},
  {3, 7, 106},
  {5, 7, 108},
};
static const int FS_EXITS_TAMHINI[] = {0, 2, 6, 8};
static const double FS_EXIT_WEIGHTS_TAMHINI[] = {26, 26, 26, 26};

static const FsForestConfig FS_FORESTS[] = {
  {3, 16, FS_EDGES_MIYAWAKI, 4, FS_EXITS_MIYAWAKI, FS_EXIT_WEIGHTS_MIYAWAKI},
  {3, 16, FS_EDGES_ANANDVAN, 4, FS_EXITS_ANANDVAN, FS_EXIT_WEIGHTS_ANANDVAN},
  {3, 16, FS_EDGES_BANER, 4, FS_EXITS_BANER, FS_EXIT_WEIGHTS_BANER},
  {3, 16, FS_EDGES_TAMHINI, 4, FS_EXITS_TAMHINI, FS_EXIT_WEIGHTS_TAMHINI},
};

#endif
