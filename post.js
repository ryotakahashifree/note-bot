// post.js - Puppeteerを使ってNote.comに記事を自動投稿する
require('dotenv').config({ path: '../n8n/.env' });
const puppeteer = require('puppeteer');

const NOTE_EMAIL = process.env.NOTE_EMAIL;
const NOTE_PASSWORD = process.env.NOTE_PASSWORD;

async function postToNote(article) {
  console.log('🚀 Note.com への投稿を開始します...');

  const browser = await puppeteer.launch({
    headless: false, // デバッグ中は画面を表示（動作確認後 true に変更）
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();

    // ① ログイン
    console.log('🔑 ログイン中...');
    await page.goto('https://note.com/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', NOTE_EMAIL, { delay: 50 });
    await page.type('input[type="password"]', NOTE_PASSWORD, { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('✅ ログイン完了');

    // ② 新規記事作成ページへ
    console.log('📝 新規記事作成ページへ移動...');
    await page.goto('https://note.com/new', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    // ③ タイトル入力
    const titleSelector = 'textarea[placeholder*="タイトル"], input[placeholder*="タイトル"], .title-input';
    await page.waitForSelector(titleSelector, { timeout: 10000 });
    await page.click(titleSelector);
    await page.keyboard.type(article.title, { delay: 30 });
    console.log('✅ タイトル入力:', article.title);

    // ④ 本文入力（無料パート）
    await page.waitForTimeout(1000);
    const bodySelector = '.ProseMirror, [contenteditable="true"], .editor-body';
    await page.waitForSelector(bodySelector, { timeout: 10000 });
    await page.click(bodySelector);
    await page.keyboard.type(article.lead + '\n\n', { delay: 20 });
    await page.keyboard.type(article.free_content + '\n\n', { delay: 20 });
    console.log('✅ 無料パート入力完了');

    // ⑤ 有料ライン設定（有料パートの前にラインを挿入）
    // Note の有料ライン設定はUIが複雑なため、まずは本文に有料パートも含める
    await page.keyboard.type(article.paid_content, { delay: 10 });
    console.log('✅ 有料パート入力完了');

    await page.waitForTimeout(2000);

    // ⑥ 投稿設定（価格・タグ）は手動確認のためここで一時停止
    console.log('⚠️  価格・タグ設定を手動で行ってください');
    console.log(`   価格: ¥${article.price}`);
    console.log(`   タグ: ${article.tags.join(', ')}`);
    console.log('   設定完了後、Enterを押すと投稿します...');

    // 確認のため30秒待機（本番では自動化）
    await page.waitForTimeout(30000);

    console.log('✅ 投稿プロセス完了（確認のため自動投稿はスキップ）');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { postToNote };

if (require.main === module) {
  // テスト用サンプル記事
  const sampleArticle = {
    title: '【2月】潜在意識があなたに送っているサイン3つ',
    lead: 'もしかして最近、同じ数字をよく見かけたり、突然懐かしい人のことを思い出したりしませんか？それは偶然ではありません。',
    free_content: '## あなたの潜在意識は常にメッセージを送っています\n\n（サンプルテキスト）',
    paid_content: '## 【有料】詳細リーディング\n\n（サンプルテキスト）',
    tags: ['スピリチュアル', '占い', '引き寄せの法則'],
    price: 500
  };

  postToNote(sampleArticle).catch(console.error);
}
