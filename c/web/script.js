const $ = (id) => document.getElementById(id);
const config = await fetch('/config/forest-graph.json').then((r) => r.json());
for (const id of Object.keys(config.forests)) { const option = document.createElement('option'); option.value=id; option.textContent=id; $('forest').appendChild(option); }
$('run').addEventListener('click', async () => {
  $('stepLabel').textContent = 'Step 5 — C / Dijkstra result';
  const payload = { forest: $('forest').value, zone: 'A', from: Number($('current').value) - 1, fires: $('fires').value.split(',').map((v)=>Number(v.trim())-1).filter(Number.isInteger), blocked_trails: [], spread_minutes: Number($('spread').value), wind_direction: 0, wind_speed_kph: Number($('wind').value), slope_percent: 0 };
  const response = await fetch('/api/evacuate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json();
  $('output').textContent = JSON.stringify(result, null, 2);
});
