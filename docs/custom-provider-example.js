/**
 * 自定义测速数据源 (Speedtest Provider) 示例服务
 *
 * 这是一个零依赖的轻量 Node.js 服务示例，可直接在自建服务器（例如重庆云主机/轻量服务器）上运行。
 * 启动后，在管理后台将自定义 API 端点设置为：http://<服务器IP>:4000/ping
 *
 * 运行方式:
 *   node docs/custom-provider-example.js
 */

const http = require('http')
const { exec } = require('child_process')

const PORT = 4000
const TOKEN = 'my-secret-token' // 可选，与管理后台的 Bearer Token 对齐，留空则不校验

// 执行单机真实 ICMP Ping 探测
function runRealPing(target, packets = 3) {
  return new Promise((resolve) => {
    // 根据系统选择 ping 命令参数 (-c for Linux/Mac, -n for Windows)
    const isWin = process.platform === 'win32'
    const cmd = isWin ? `ping -n ${packets} ${target}` : `ping -c ${packets} ${target}`

    exec(cmd, (err, stdout) => {
      let avg = 25.0
      let loss = 0

      // 解析 Linux 输出中的 avg: rtt min/avg/max/mdev = 20.1/25.4/30.2/2.1 ms
      const linuxMatch = stdout.match(/=\s*[\d.]+\/([\d.]+)\//)
      if (linuxMatch) {
        avg = parseFloat(linuxMatch[1])
      }

      // 解析 Windows 输出中的 平均 = 25ms
      const winMatch = stdout.match(/Average = (\d+)ms|平均 = (\d+)ms/)
      if (winMatch) {
        avg = parseFloat(winMatch[1] || winMatch[2])
      }

      // 解析丢包率
      const lossMatch = stdout.match(/(\d+)% packet loss|(\d+)% 丢失/)
      if (lossMatch) {
        loss = parseFloat(lossMatch[1] || lossMatch[2])
      }

      resolve({ avg, loss, rawOutput: stdout })
    })
  })
}

const server = http.createServer(async (req, res) => {
  // 设置 CORS 跨域头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/ping') {
    // 校验 Bearer Token (如配置)
    if (TOKEN) {
      const auth = req.headers['authorization']
      if (auth !== `Bearer ${TOKEN}`) {
        res.writeHead(401)
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid token' }))
        return
      }
    }

    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}')
        const target = payload.target || '1.1.1.1'
        const packets = payload.packets || 3

        console.log(`[Custom Provider] 收到测速请求: 目标=${target}, 发包=${packets}`)

        // 示例：执行本机真实 Ping 探测 (例如部署在重庆节点的主机)
        const pingResult = await runRealPing(target, packets)
        const finalAvg = pingResult.avg > 0 ? pingResult.avg : 28.5

        // 返回标准化的探针数组
        const responseData = {
          probes: [
            {
              id: 'cq-node-01',
              city: '重庆', // 支持写 "重庆" 或 "Chongqing"，系统会自动映射为 "重庆市"
              carrier: 'unicom', // 可选: telecom (电信) | unicom (联通) | mobile (移动) | edu | other
              carrierName: '重庆联通骨干',
              avg: finalAvg,
              min: Math.round(finalAvg * 0.95 * 10) / 10,
              max: Math.round(finalAvg * 1.05 * 10) / 10,
              loss: pingResult.loss,
              rawOutput: pingResult.rawOutput,
            },
            // 如果您在其他城市（如新疆/西藏等）也有节点或代理，也可一并返回
          ],
        }

        res.writeHead(200)
        res.end(JSON.stringify(responseData))
      } catch (err) {
        res.writeHead(500)
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Not Found' }))
})

server.listen(PORT, () => {
  console.log(`[Custom Provider] 测速数据源服务已在端口 ${PORT} 启动`)
  console.log(`端点地址: http://127.0.0.1:${PORT}/ping`)
  console.log(`Token: ${TOKEN}`)
})
