const { Sentinel, resetSentinel } = require('./dist/index.js');
const fs = require('fs');

async function main() {
  const s = resetSentinel({ enableLayer15: true });

  const content = fs.readFileSync('./test-cases-1000.txt', 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('🔍') && !l.startsWith('🚧') && !l.startsWith('🕊️'));

  let blocked = 0;
  let passed = 0;
  let layer1Blocked = 0;
  let layer15Blocked = 0;

  for (const line of lines.slice(0, 500)) {
    const msg = line.replace(/^\d+\s+/, '').trim();
    if (!msg) continue;
    
    const result = s.scanInput(msg);
    if (!result.pass) {
      layer1Blocked++;
      blocked++;
    } else {
      const fullResult = await s.fullScan(msg);
      if (!fullResult.pass) {
        layer15Blocked++;
        blocked++;
      } else {
        passed++;
      }
    }
  }

  const total = blocked + passed;
  console.log('测试用例:', total);
  console.log('Layer 1 拦截:', layer1Blocked, '(' + (layer1Blocked/total*100).toFixed(1) + '%)');
  console.log('Layer 1.5 拦截:', layer15Blocked, '(' + (layer15Blocked/total*100).toFixed(1) + '%)');
  console.log('放行:', passed, '(' + (passed/total*100).toFixed(1) + '%)');
  console.log('总拦截率:', (blocked / total * 100).toFixed(2) + '%');
}

main().catch(console.error);
