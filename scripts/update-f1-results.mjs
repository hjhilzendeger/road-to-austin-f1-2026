// Update only races that can be matched unambiguously to the dashboard calendar.
// Run with Node 22+. Fails closed if the source is incomplete or inconsistent.
import fs from 'node:fs/promises';
const path = 'public/f1-2026-data.json';
const data = JSON.parse(await fs.readFile(path, 'utf8'));
const driverIds = new Set(data.drivers.map(d => d.id));
const normalize = s => String(s).toLowerCase().replace(/grand prix|formula 1|2026|[^a-z]/g, '');
const aliases = { 'unitedstates':'unitedstates', 'mexicocity':'mexicocity', 'saopaulo':'saopaulo', 'abudhabi':'abudhabi' };
function match(a,b) { const x=normalize(a),y=normalize(b); return x===y || aliases[x]===y; }
async function get(url) {
  const res=await fetch(url,{headers:{'User-Agent':'road-to-austin-2026-results-bot'}});
  if(!res.ok) throw new Error('Results API '+res.status);
  return (await res.json()).MRData.RaceTable.Races || [];
}
const base='https://api.jolpi.ca/ergast/f1/2026';
const races=await get(base+'/results/1/?limit=100');
let changes=0;
for(const race of races) {
  const round=Number(race.round);
  const cal=data.calendar.find(c=>c.round===round);
  if(!cal || !match(cal.name,race.raceName)) {
    console.log('Skipping unmatched round',round,race.raceName);
    continue;
  }
  // Require the full classified field, not the winner-only response.
  const full=(await get(base+'/'+round+'/results/?limit=100'))[0];
  if(!full || !Array.isArray(full.Results) || full.Results.length<18) continue;
  const entries=full.Results.map(r=>{
    const id=r.Driver.code;
    if(!driverIds.has(id)) throw new Error('Unknown driver '+id+' at round '+round);
    const pos=Number(r.position);
    const finish=Number.isInteger(pos)&&pos>0?pos:'DNF';
    const gap=r.Time?.time || (r.status==='Finished'?'Finished':r.status);
    return {id,grid:Number(r.grid)||null,finish,laps:Number(r.laps)||0,gap,pts:Number(r.points)||0};
  });
  if(new Set(entries.map(x=>x.id)).size!==entries.length) throw new Error('Duplicate driver in '+round);
  const existing=data.raceResults[String(round)];
  if(existing?.meta?.classificationStatus==='final') {
    console.log('Keeping existing final result for round',round);
    continue;
  }
  // Preserve manually authored editorial content; do not generate stories.
  data.raceResults[String(round)]={
    ...(existing||{}),
    meta:{...(existing?.meta||{}),classificationStatus:'provisional',note:'Automated classification from Jolpica; verify against official F1 results.'},
    headline:existing?.headline||race.raceName+' results',
    recap:existing?.recap||'Results imported automatically; official confirmation pending.',
    keyMoments:existing?.keyMoments||[],
    notablePerformances:existing?.notablePerformances||[],
    sourceUrl:'https://www.formula1.com/en/results/2026/races',
    results:entries,
    sprint:existing?.sprint||null
  };
  changes++;
}
if(changes) {
  await fs.writeFile(path,JSON.stringify(data,null,2)+'\n');
  console.log('Updated',changes,'races');
} else console.log('No eligible changes');
