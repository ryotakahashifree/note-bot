// generate.js - Gemini APIでスピリチュアル記事を生成
require('dotenv').config({ path: '../n8n/.env' });
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function getMonthName() {
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  return months[new Date().getMonth()];
}

// ランダムテーマ選択
function getRandomTheme() {
  const themes = [
    { free_topic: '星座別・今月あなたに降りてくるメッセージ', paid_topic: '12星座すべての詳細リーディング＋魂の使命' },
    { free_topic: '潜在意識があなたに送っているサイン3つ', paid_topic: '潜在意識の深層を読み解く7段階ワーク' },
    { free_topic: '前世の記憶があなたの今生を縛っている理由', paid_topic: '前世タイプ別・今世で解放すべきカルマ診断' },
    { free_topic: '引き寄せができない人に共通する「波動の癖」', paid_topic: '波動タイプ別・今すぐできる浄化ワーク完全版' },
    { free_topic: '数秘術で分かる、あなたの今月の運命数', paid_topic: '誕生日から読む魂のロードマップ完全解読' },
    { free_topic: '守護霊があなたに伝えたいこと【無料チャネリング】', paid_topic: '守護霊・ハイヤーセルフからの詳細メッセージ' },
    { free_topic: 'エネルギーが低下している人に現れる7つのサイン', paid_topic: 'エネルギーチャクラ別・完全浄化プログラム' },
  ];
  return themes[Math.floor(Math.random() * themes.length)];
}

async function generateArticle() {
  const month = getMonthName();
  const theme = getRandomTheme();

  const prompt = `
あなたはnote.comで月収50万円以上を稼いでいる人気スピリチュアルライターです。
以下の仕様で、読者が「続きが読みたい！」と思うnote記事を生成してください。

【無料パートテーマ】${month}の「${theme.free_topic}」
【有料パートテーマ】${theme.paid_topic}
【価格】¥500
【文体】神秘的・共感的・「あなただけに教える」感

【本文フォーマット（重要）】
- ##, ###, ####, **, * などのマークダウン記号は一切使わない
- セクション見出しは ✨【見出しタイトル】✨ の形式を使う
- 箇条書きは「・」を使う
- 区切り線は「━━━━━━━━━━」を使う
- 絵文字を積極的に使い、神秘的・スピリチュアルな雰囲気を出す（✨💫🔮🌙⭐🌟💜🌸）

## 出力仕様（JSON形式）

{
  "title": "【タイトル】（35文字以内。数字・${month}・診断・あなたの○○などを活用）",
  "lead": "リード文（150文字。『もしかしてこんな感覚ありませんか？』から始め、共感で引き込む）",
  "free_content": "無料パート本文（プレーンテキスト＋絵文字・【】形式・600文字。マークダウン記号なし。テーマを2〜3点解説し、最後は『実は○○には続きがあります▼』で有料誘導）",
  "paid_content": "有料パート本文（プレーンテキスト＋絵文字・【】形式・1200文字。マークダウン記号なし。詳細な診断・ワーク・メッセージを展開。具体的で読者が『これは私のことだ』と感じる内容）",
  "tags": ["スピリチュアル", "占い", "引き寄せの法則", "自己啓発", "潜在意識"],
  "price": 500,
  "image_prompt": "英語のAI画像生成プロンプト（例: ethereal spiritual woman, purple golden divine light, sacred geometry, mystical cosmic background, high quality, dreamy atmosphere）テーマに合わせて30語以内で"
}

JSONのみ出力してください。説明文は不要。
`;

  const response = await axios.post(GEMINI_URL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 8192 }
  });

  const rawText = response.data.candidates[0].content.parts[0].text;
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSONが取得できませんでした:\n' + rawText);

  const article = JSON.parse(jsonMatch[0]);
  console.log('✅ 記事生成完了:', article.title);
  return article;
}

module.exports = { generateArticle };

if (require.main === module) {
  generateArticle().then(a => {
    console.log('\n=== 生成された記事 ===');
    console.log('タイトル:', a.title);
    console.log('タグ:', a.tags);
    console.log('価格: ¥' + a.price);
    console.log('\n--- 無料パート ---');
    console.log(a.free_content.substring(0, 200) + '...');
  }).catch(console.error);
}
