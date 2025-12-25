/**
 * Google Maps Directions API テストスクリプト
 * 
 * 使用方法:
 * node test-google-maps-api.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env.localファイルを直接読み込む
function loadEnvFile() {
  try {
    const envPath = resolve(__dirname, '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const envVars = {}
    
    envContent.split('\n').forEach((line) => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    
    return envVars
  } catch (error) {
    console.error('Error loading .env.local:', error.message)
    return {}
  }
}

const envVars = loadEnvFile()
const GOOGLE_MAPS_API_KEY = envVars.VITE_GOOGLE_MAPS_API_KEY

async function testGoogleMapsAPI() {
  console.log('='.repeat(60))
  console.log('Google Maps Directions API テスト')
  console.log('='.repeat(60))
  console.log()

  // 1. 環境変数の確認
  console.log('1. 環境変数の確認')
  console.log('-'.repeat(60))
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ VITE_GOOGLE_MAPS_API_KEY が設定されていません')
    console.error('   .env.local ファイルを確認してください')
    process.exit(1)
  }
  console.log(`✅ APIキーが設定されています: ${GOOGLE_MAPS_API_KEY.substring(0, 10)}...`)
  console.log()

  // 2. APIリクエストのテスト
  console.log('2. APIリクエストのテスト')
  console.log('-'.repeat(60))
  
  const testCases = [
    {
      name: 'テスト1: 三重県内のルート',
      origin: '三重県鈴鹿市平田町',
      destination: '三重県鈴鹿市白子町',
    },
    {
      name: 'テスト2: 東京駅から新宿駅',
      origin: '東京駅',
      destination: '新宿駅',
    },
    {
      name: 'テスト3: 同じリクエストを再度実行（キャッシュ確認）',
      origin: '三重県鈴鹿市平田町',
      destination: '三重県鈴鹿市白子町',
    },
  ]
  
  // リクエスト間隔を追加（レート制限対策）
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  for (const testCase of testCases) {
      console.log(`\n${testCase.name}`)
      console.log(`  出発地: ${testCase.origin}`)
      console.log(`  目的地: ${testCase.destination}`)
      
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(testCase.origin)}&destination=${encodeURIComponent(testCase.destination)}&key=${GOOGLE_MAPS_API_KEY}&language=ja`
        
        if (process.env.DEBUG) {
          console.log(`  リクエストURL: ${url.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`)
        }
        
        console.log('  リクエスト送信中...')
        const startTime = Date.now()
        const response = await fetch(url)
        const requestTime = Date.now() - startTime
        console.log(`  レスポンス時間: ${requestTime}ms`)
      
      if (!response.ok) {
        console.error(`  ❌ HTTPエラー: ${response.status} ${response.statusText}`)
        const errorText = await response.text()
        console.error(`  レスポンス: ${errorText}`)
        continue
      }
      
      const data = await response.json()
      
      console.log(`  ステータス: ${data.status}`)
      
      if (data.status === 'OK') {
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0]
          const leg = route.legs[0]
          const durationMinutes = Math.round(leg.duration.value / 60)
          const distanceKm = (leg.distance.value / 1000).toFixed(1)
          
          console.log(`  ✅ 成功`)
          console.log(`  所要時間: ${durationMinutes}分`)
          console.log(`  距離: ${distanceKm}km`)
          console.log(`  ルート名: ${route.summary || 'N/A'}`)
          console.log(`  開始地点: ${leg.start_address}`)
          console.log(`  終了地点: ${leg.end_address}`)
        } else {
          console.error('  ❌ ルートが見つかりませんでした')
        }
      } else {
        console.error(`  ❌ エラー: ${data.status}`)
        if (data.error_message) {
          console.error(`  エラーメッセージ: ${data.error_message}`)
        }
        
        // レスポンスの詳細を表示
        if (process.env.DEBUG) {
          console.error(`  レスポンス全体:`, JSON.stringify(data, null, 2))
        }
        
        // エラーの種類に応じた解決方法を表示
        if (data.status === 'REQUEST_DENIED') {
          console.error('\n  解決方法:')
          if (data.error_message && data.error_message.includes('referer')) {
            console.error('  1. Google Cloud ConsoleでAPIキーの制限を確認')
            console.error('  2. 「アプリケーションの制限」を「なし」に変更（開発環境）')
            console.error('  3. または「IPアドレス」を選択')
          } else {
            console.error('  1. Directions APIが有効になっているか確認')
            console.error('  2. APIキーの権限を確認')
            console.error('  3. Google Cloud Console: https://console.cloud.google.com/apis/credentials')
          }
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          console.error('\n  解決方法:')
          console.error('  1. APIの使用量制限に達しています')
          console.error('  2. 課金設定を確認してください')
        }
      }
    } catch (error) {
      console.error(`  ❌ エラーが発生しました: ${error.message}`)
      if (error.message.includes('fetch')) {
        console.error('  ネットワークエラーの可能性があります')
        console.error('  インターネット接続を確認してください')
      }
    }
    
    // リクエスト間隔を空ける（レート制限対策）
    if (testCase !== testCases[testCases.length - 1]) {
      await delay(1000) // 1秒待機
    }
  }
  
  console.log()
  console.log('='.repeat(60))
  console.log('テスト完了')
  console.log('='.repeat(60))
}

// テスト実行
testGoogleMapsAPI().catch((error) => {
  console.error('テスト実行中にエラーが発生しました:', error)
  process.exit(1)
})

