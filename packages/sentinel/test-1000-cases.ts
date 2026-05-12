import { getLegalKnowledgeBase } from './dist/legal-knowledge.js'
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
  const agent = new InferenceAgent({
    llmProvider,
    model: 'astron-code-latest'
  })

  const kb = getLegalKnowledgeBase()
  const provisionCount = await kb.loadFromDirectory('./legal-docs')

  console.log('══════════════════════════════════════════════════════════════')
  console.log(`Sentinel 拦截测试 - 1000条测试用例`)
  console.log(`法律知识库: ${provisionCount} 条`)
  console.log('══════════════════════════════════════════════════════════════\n')

  // 读取测试用例
  const testContent = fs.readFileSync('./test-cases-1000.txt', 'utf-8')
  const lines = testContent.split('\n').filter(line => line.trim() && !line.startsWith('🧪') && !line.startsWith('🎭') && !line.startsWith('🕵️') && !line.startsWith('💔') && !line.startsWith('🚨') && !line.startsWith('🚫') && !line.startsWith('🌐'))

  console.log(`测试用例总数: ${lines.length}\n`)

  const stats = {
    total: 0,
    blocked: 0,
    passed: 0,
    errors: 0,
  }

  // 记录结果
  const results: Array<{msg: string, blocked: boolean, reason: string}> = []

  for (const msg of lines) {
    if (!msg.trim()) continue

    stats.total++

    try {
      const result = await agent.infer({ message: msg.trim(), jurisdiction: 'CN' })

      if (result.needsTakeover) {
        stats.blocked++
        results.push({ msg: msg.trim(), blocked: true, reason: result.reasoning.slice(0, 50) })
      } else {
        stats.passed++
        results.push({ msg: msg.trim(), blocked: false, reason: result.reasoning.slice(0, 50) })
      }

      // 每100条输出进度
      if (stats.total % 100 === 0) {
        console.log(`进度: ${stats.total}/${lines.length} | 拦截: ${stats.blocked} | 放行: ${stats.passed}`)
      }
    } catch (error) {
      stats.errors++
      results.push({ msg: msg.trim(), blocked: false, reason: 'Error' })
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('测试结果统计')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`总测试数: ${stats.total}`)
  console.log(`拦截: ${stats.blocked} | 放行: ${stats.passed} | 错误: ${stats.errors}`)
  console.log(`拦截率: ${(stats.blocked / stats.total * 100).toFixed(2)}%`)
  console.log('══════════════════════════════════════════════════════════════')

  // 保存放行的案例（可能需要人工审核）
  const passedCases = results.filter(r => !r.blocked)
  if (passedCases.length > 0) {
    console.log('\n放行的案例（需要人工审核）:')
    passedCases.slice(0, 20).forEach(r => {
      console.log(`  ✅ "${r.msg.slice(0, 50)}..."`)
    })
    if (passedCases.length > 20) {
      console.log(`  ... 还有 ${passedCases.length - 20} 条`)
    }
  }

  // 保存结果到文件
  fs.writeFileSync('./test-results.json', JSON.stringify(results, null, 2))
  console.log('\n详细结果已保存到 test-results.json')
}

runTests().catch(console.error)
