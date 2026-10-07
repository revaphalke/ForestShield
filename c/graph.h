#ifndef FORESTSHIELD_GRAPH_H
#define FORESTSHIELD_GRAPH_H

#include "graph_config.h"
#include <stdbool.h>
#include <stddef.h>

#define MAX_CELLS FS_MAX_CELLS
#define EXIT_NODE MAX_CELLS
#define MAX_NODES (MAX_CELLS + 1)
#define MAX_PATH MAX_CELLS
#define MAX_FIRE_ZONES MAX_CELLS
#define MAX_BLOCKED_EDGES FS_MAX_BLOCKED_EDGES
#define MAX_PQ FS_MAX_PQ
#define INF_DIST 1e12
#define CAUTION_MULT FS_CAUTION_MULT
#define WALK_MPS FS_WALK_MPS

typedef struct Edge { int to; double weight; struct Edge *next; } Edge;
typedef struct Graph { int n; Edge *adj[MAX_NODES]; } Graph;
typedef struct Queue { int data[MAX_NODES]; int head; int tail; } Queue;
typedef struct PQItem { int node; double dist; } PQItem;
typedef struct PriorityQueue { PQItem items[MAX_PQ]; int size; } PriorityQueue;

typedef struct ScenarioInputs {
    int spread_minutes;
    double wind_direction;
    double wind_speed_kph;
    double slope_percent;
} ScenarioInputs;

typedef struct EvacuateResult {
    int ok;
    char error[48];
    int path[MAX_PATH];
    int path_len;
    int exit_cell;
    double distance_m;
    double eta_min;
    double risk_cost;
    int danger[MAX_NODES];
    int n_danger;
    int caution[MAX_NODES];
    int n_caution;
    int blocked_list[MAX_NODES];
    int n_blocked;
    char blocked_trails[MAX_BLOCKED_EDGES][16];
    int n_blocked_trails;
    int fires[MAX_FIRE_ZONES];
    int n_fires;
    int predicted_spread[MAX_CELLS];
    int n_predicted_spread;
    int scenario_risk;
    char scenario_summary[96];
    int spread_minutes;
    double wind_direction;
    double wind_speed_kph;
    double slope_percent;
    char engine[32];
} EvacuateResult;

void q_init(Queue *q); int q_empty(const Queue *q); void q_push(Queue *q, int v); int q_pop(Queue *q);
void pq_init(PriorityQueue *pq); int pq_empty(const PriorityQueue *pq); void pq_push(PriorityQueue *pq, int node, double dist); PQItem pq_pop(PriorityQueue *pq);
void graph_init(Graph *g, int n); void graph_add_undirected(Graph *g, int u, int v, double w); void graph_free(Graph *g);
const FsForestConfig *forest_config(const char *forest_id);
void graph_build_forest(Graph *g, const char *forest_id, const char blocked_edges[][16], int blocked_edge_count);
int neighbors4(int idx, int grid_size, int out[4]);
int parse_cell(const char *s);
const char *normalise_forest(const char *id);
int edge_is_blocked(int u, int v, const char blocked_edges[][16], int blocked_edge_count);
void predict_fire_spread(const FsForestConfig *cfg, const int fires[MAX_FIRE_ZONES], int fire_count, const ScenarioInputs *inputs, int out[MAX_CELLS], int *out_count);
void bfs_expand_fires(const FsForestConfig *cfg, const int fires[MAX_FIRE_ZONES], int fire_count, int start, int blocked[MAX_NODES], int caution[MAX_NODES], int danger_list[MAX_NODES], int *n_danger, int caution_list[MAX_NODES], int *n_caution);
int dijkstra(const Graph *g, int src, const int blocked[MAX_NODES], const int caution[MAX_NODES], double dist[MAX_NODES], int prev[MAX_NODES]);
int reconstruct_path(const int prev[MAX_NODES], int src, int exit_node, int path[MAX_PATH], int *path_len, int *exit_cell);
int recalculateRoute(const char *forest, int current, const int fires[MAX_FIRE_ZONES], int fire_count, const ScenarioInputs *inputs, const char blocked_edges[][16], int blocked_edge_count, EvacuateResult *result);
EvacuateResult evacuate_compute_multi(const char *forest, int from, const int fires[MAX_FIRE_ZONES], int fire_count, const ScenarioInputs *inputs, const char blocked_edges[][16], int blocked_edge_count);

#endif
