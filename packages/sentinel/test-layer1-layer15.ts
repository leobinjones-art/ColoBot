/**
 * Layer 1 + Layer 1.5 拦截测试
 * 不调用 LLM，仅测试规则引擎和本地意图分析器
 */

import { RuleEngine, resetRuleEngine } from './dist/rule-engine.js'
import { LocalIntentAnalyzer, resetLocalIntentAnalyzer } from './dist/local-intent-analyzer.js'
import * as fs from 'fs'

async function runTests() {
  const ruleEngine = resetRuleEngine()
  const localAnalyzer = resetLocalIntentAnalyzer({ confidenceThreshold: 0.75 })

  // 读取测试用例
  const testContent = fs.readFileSync('./test-cases-1000.txt', 'utf-8')
  const lines = testContent.split('\n').filter(line =>
    line.trim() &&
    !line.startsWith('🧪') &&
    !line.startsWith('🎭') &&
    !line.startsWith('🕵️') &&
    !line.startsWith('💔') &&
    !line.startsWith('🚨') &&
    !line.startsWith('🚫') &&
    !line.startsWith('🌐') &&
    !line.startsWith('📚') &&
    !line.startsWith('⚠️') &&
    !line.startsWith('🔬') &&
    !line.startsWith('🎯') &&
    !line.startsWith('🛡️') &&
    !line.startsWith('🤖') &&
    !line.startsWith('🧬') &&
    !line.startsWith('📊') &&
    !line.startsWith('💡') &&
    !line.startsWith('🔍')
  )

  console.log('══════════════════════════════════════════════════════════════')
  console.log(`Layer 1 + Layer 1.5 拦截测试`)
  console.log(`测试用例总数: ${lines.length}`)
  console.log('══════════════════════════════════════════════════════════════\n')

  const stats = {
    total: 0,
    layer1Blocked: 0,
    layer15Dangerous: 0,
    layer15Suspicious: 0,
    passed: 0,
    layer2Needed: 0,
  }

  const results: Array<{
    msg: string
    layer1: { pass: boolean; reason?: string; matched?: string }
    layer15: { category: string; confidence: number; needsLayer2: boolean }
    final: 'blocked' | 'passed' | 'needs_layer2'
  }> = []

  for (const msg of lines) {
    if (!msg.trim()) continue

    stats.total++

    // Layer 1: 规则引擎
    const layer1Result = ruleEngine.scanInput(msg.trim())

    if (!layer1Result.pass) {
      stats.layer1Blocked++
      results.push({
        msg: msg.trim(),
        layer1: { pass: false, reason: layer1Result.reason, matched: layer1Result.matched },
        layer15: { category: 'skipped', confidence: 0, needsLayer2: false },
        final: 'blocked'
      })
      continue
    }

    // Layer 1.5: 本地意图分析
    const layer15Result = localAnalyzer.analyze(msg.trim())

    if (layer15Result.category === 'dangerous') {
      stats.layer15Dangerous++
      results.push({
        msg: msg.trim(),
        layer1: { pass: true },
        layer15: { category: layer15Result.category, confidence: layer15Result.confidence, needsLayer2: false },
        final: 'blocked'
      })
      continue
    }

    if (layer15Result.category === 'suspicious' && layer15Result.needsLayer2) {
      stats.layer15Suspicious++
      stats.layer2Needed++
      results.push({
        msg: msg.trim(),
        layer1: { pass: true },
        layer15: { category: layer15Result.category, confidence: layer15Result.confidence, needsLayer2: true },
        final: 'needs_layer2'
      })
      continue
    }

    // 通过
    stats.passed++
    results.push({
      msg: msg.trim(),
      layer1: { pass: true },
      layer15: { category: layer15Result.category, confidence: layer15Result.confidence, needsLayer2: layer15Result.needsLayer2 },
      final: 'passed'
    })

    // 每100条输出进度
    if (stats.total % 100 === 0) {
      console.log(`进度: ${stats.total}/${lines.length} | L1: ${stats.layer1Blocked} | L1.5危险: ${stats.layer15Dangerous} | L1.5可疑: ${stats.layer15Suspicious} | 放行: ${stats.passed}`)
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('测试结果统计')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`总测试数: ${stats.total}`)
  console.log(`Layer 1 拦截: ${stats.layer1Blocked} (${(stats.layer1Blocked / stats.total * 100).toFixed(2)}%)`)
  console.log(`Layer 1.5 拦截(危险): ${stats.layer15Dangerous} (${(stats.layer15Dangerous / stats.total * 100).toFixed(2)}%)`)
  console.log(`Layer 1.5 可疑(需L2): ${stats.layer15Suspicious} (${(stats.layer15Suspicious / stats.total * 100).toFixed(2)}%)`)
  console.log(`放行: ${stats.passed} (${(stats.passed / stats.total * 100).toFixed(2)}%)`)
  console.log('────────────────────────────────────────────────────────────')
  console.log(`总拦截率: ${((stats.layer1Blocked + stats.layer15Dangerous) / stats.total * 100).toFixed(2)}%`)
  console.log(`需Layer 2处理: ${((stats.layer15Suspicious + stats.passed) / stats.total * 100).toFixed(2)}%`)
  console.log('══════════════════════════════════════════════════════════════')

  // 分析放行的案例
  const passedCases = results.filter(r => r.final === 'passed')
  console.log('\n放行案例分析（前30条）:')
  passedCases.slice(0, 30).forEach(r => {
    console.log(`  ✅ "${r.msg.slice(0, 60)}..." [${r.layer15.category}]`)
  })
  if (passedCases.length > 30) {
    console.log(`  ... 还有 ${passedCases.length - 30} 条放行`)
  }

  // 分析可疑案例
  const suspiciousCases = results.filter(r => r.final === 'needs_layer2')
  console.log('\n可疑案例分析（前20条）:')
  suspiciousCases.slice(0, 20).forEach(r => {
    console.log(`  ⚠️ "${r.msg.slice(0, 60)}..." [${r.layer15.category}]`)
  })
  if (suspiciousCases.length > 20) {
    console.log(`  ... 还有 ${suspiciousCases.length - 20} 条可疑`)
  }

  // 分析 Layer 1 拦截案例
  const layer1BlockedCases = results.filter(r => r.final === 'blocked' && !r.layer1.pass)
  console.log('\nLayer 1 拦截案例分析（前20条）:')
  layer1BlockedCases.slice(0, 20).forEach(r => {
    console.log(`  🚫 "${r.msg.slice(0, 50)}..." [${r.layer1.reason}: ${r.layer1.matched || ''}]`)
  })
  if (layer1BlockedCases.length > 20) {
    console.log(`  ... 还有 ${layer1BlockedCases.length - 20} 条`)
  }

  // 分析 Layer 1.5 拦截案例
  const layer15BlockedCases = results.filter(r => r.final === 'blocked' && r.layer1.pass)
  console.log('\nLayer 1.5 拦截案例分析（前20条）:')
  layer15BlockedCases.slice(0, 20).forEach(r => {
    console.log(`  🔒 "${r.msg.slice(0, 50)}..." [${r.layer15.category}]`)
  })
  if (layer15BlockedCases.length > 20) {
    console.log(`  ... 还有 ${layer15BlockedCases.length - 20} 条`)
  }

  // 保存结果
  fs.writeFileSync('./layer1-layer15-results.json', JSON.stringify(results, null, 2))
  console.log('\n详细结果已保存到 layer1-layer15-results.json')
}

runTests().catch(console.error)