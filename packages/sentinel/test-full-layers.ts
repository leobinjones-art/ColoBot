/**
 * 完整三层防御测试 - Layer 1 + Layer 1.5 + Layer 2
 */

import { resetRuleEngine } from './dist/rule-engine.js'
import { resetLocalIntentAnalyzer } from './dist/local-intent-analyzer.js'
import { InferenceAgent } from './dist/inference-agent.js'
import * as fs from 'fs'

// LLM Provider 配置
const llmProvider = {
  name: 'xfyun',
  chat: async (messages: Array<{role: string; content: string}>, options?: {model?: string}) => {
    const response = await fetch('https://maas-coding-api.cn-huabei-1.xf-yun.com/v2/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 630e22be498950c3aaaefa6a9064367a:ZWVhODZkZTBmYjY1YjBmODY0NjY5MzZl'
      },
      body: JSON.stringify({
        model: options?.model || 'astron-code-latest',
        messages
      })
    })

    const data = await response.json()
    return {
      content: data.choices?.[0]?.message?.content || ''
    }
  },
  chatStream: async function* () { yield '' }
}

async function runTests() {
  const ruleEngine = resetRuleEngine()
  const localAnalyzer = resetLocalIntentAnalyzer({ confidenceThreshold: 0.75 })
  const inferenceAgent = new InferenceAgent({
    llmProvider,
    model: 'astron-code-latest'
  })

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
  console.log(`完整三层防御测试 - Layer 1 + Layer 1.5 + Layer 2`)
  console.log(`测试用例总数: ${lines.length}`)
  console.log('══════════════════════════════════════════════════════════════\n')

  const stats = {
    total: 0,
    layer1Blocked: 0,
    layer15Blocked: 0,
    layer2Blocked: 0,
    passed: 0,
    errors: 0,
  }

  const results: Array<{
    msg: string
    layer: number
    blocked: boolean
    reason: string
  }> = []

  for (const msg of lines) {
    if (!msg.trim()) continue

    stats.total++

    try {
      // Layer 1: 规则引擎
      const layer1Result = ruleEngine.scanInput(msg.trim())

      if (!layer1Result.pass) {
        stats.layer1Blocked++
        results.push({ msg: msg.trim(), layer: 1, blocked: true, reason: layer1Result.reason || '' })
        continue
      }

      // Layer 1.5: 本地意图分析
      const layer15Result = localAnalyzer.analyze(msg.trim())

      if (layer15Result.category === 'dangerous') {
        stats.layer15Blocked++
        results.push({ msg: msg.trim(), layer: 1.5, blocked: true, reason: layer15Result.reason })
        continue
      }

      // Layer 2: LLM 推理
      const layer2Result = await inferenceAgent.infer({ message: msg.trim(), jurisdiction: 'CN' })

      if (layer2Result.needsTakeover || layer2Result.scenario === 'blocked') {
        stats.layer2Blocked++
        results.push({ msg: msg.trim(), layer: 2, blocked: true, reason: layer2Result.reasoning.slice(0, 80) })
        continue
      }

      // 通过所有层
      stats.passed++
      results.push({ msg: msg.trim(), layer: 0, blocked: false, reason: layer2Result.reasoning.slice(0, 50) })

      // 每50条输出进度
      if (stats.total % 50 === 0) {
        console.log(`进度: ${stats.total}/${lines.length} | L1: ${stats.layer1Blocked} | L1.5: ${stats.layer15Blocked} | L2: ${stats.layer2Blocked} | 放行: ${stats.passed}`)
      }
    } catch (error) {
      stats.errors++
      results.push({ msg: msg.trim(), layer: 0, blocked: false, reason: 'Error' })
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('测试结果统计')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`总测试数: ${stats.total}`)
  console.log(`Layer 1 拦截: ${stats.layer1Blocked} (${(stats.layer1Blocked / stats.total * 100).toFixed(2)}%)`)
  console.log(`Layer 1.5 拦截: ${stats.layer15Blocked} (${(stats.layer15Blocked / stats.total * 100).toFixed(2)}%)`)
  console.log(`Layer 2 拦截: ${stats.layer2Blocked} (${(stats.layer2Blocked / stats.total * 100).toFixed(2)}%)`)
  console.log(`放行: ${stats.passed} (${(stats.passed / stats.total * 100).toFixed(2)}%)`)
  console.log(`错误: ${stats.errors}`)
  console.log('────────────────────────────────────────────────────────────')
  console.log(`总拦截率: ${((stats.layer1Blocked + stats.layer15Blocked + stats.layer2Blocked) / stats.total * 100).toFixed(2)}%`)
  console.log('══════════════════════════════════════════════════════════════')

  // 分析放行的案例
  const passedCases = results.filter(r => !r.blocked)
  console.log('\n放行案例分析（前20条）:')
  passedCases.slice(0, 20).forEach(r => {
    console.log(`  ✅ "${r.msg.slice(0, 60)}..."`)
  })
  if (passedCases.length > 20) {
    console.log(`  ... 还有 ${passedCases.length - 20} 条放行`)
  }

  // 保存结果
  fs.writeFileSync('./full-layer-results.json', JSON.stringify(results, null, 2))
  console.log('\n详细结果已保存到 full-layer-results.json')
}

runTests().catch(console.error)