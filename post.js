// post.js - Puppeteerを使ってNote.comに記事を自動投稿する
require('dotenv').config({ path: '../n8n/.env' });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

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
    await page.goto('https://note.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // スクリーンショットでページ状態を確認
    await page.screenshot({ path: 'd:/claudecode/note-bot/debug-login.png' });
    console.log('📸 スクリーンショット保存: debug-login.png');

    // メールアドレス入力（複数セレクタを試行）
    const emailSelectors = [
      '.o-login__mailField input',
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="メール"]',
      'input[placeholder*="mail"]',
    ];

    let emailInput = null;
    for (const sel of emailSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        emailInput = sel;
        console.log('✅ メール入力フィールド発見:', sel);
        break;
      } catch {
        // 次のセレクタを試す
      }
    }

    if (!emailInput) {
      await page.screenshot({ path: 'd:/claudecode/note-bot/debug-error.png' });
      throw new Error('メール入力フィールドが見つかりませんでした（debug-error.png 参照）');
    }

    await page.click(emailInput);
    await page.type(emailInput, NOTE_EMAIL, { delay: 50 });

    // パスワード入力
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.type('input[type="password"]', NOTE_PASSWORD, { delay: 50 });

    // Enterキーでログイン送信
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    console.log('✅ ログイン完了 - URL:', page.url());

    // ② 新規記事作成ページへ
    console.log('📝 新規記事作成ページへ移動...');
    await page.goto('https://note.com/new', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // ③ タイトル入力
    const titleSelectors = [
      'textarea[placeholder*="タイトル"]',
      'input[placeholder*="タイトル"]',
      '.title-input',
      '[data-placeholder*="タイトル"]',
    ];

    let titleInput = null;
    for (const sel of titleSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        titleInput = sel;
        break;
      } catch {}
    }

    if (titleInput) {
      await page.click(titleInput);
      await page.keyboard.type(article.title, { delay: 30 });
      console.log('✅ タイトル入力:', article.title);
    } else {
      console.warn('⚠️ タイトルフィールドが見つかりませんでした');
    }

    // ④ 本文入力
    await new Promise(r => setTimeout(r, 1000));
    const bodySelectors = [
      '.ProseMirror',
      '[contenteditable="true"]',
      '.editor-body',
      '.note-editor [contenteditable]',
    ];

    let bodyInput = null;
    for (const sel of bodySelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        bodyInput = sel;
        break;
      } catch {}
    }

    if (bodyInput) {
      await page.click(bodyInput);
      await page.keyboard.type(article.lead + '\n\n', { delay: 20 });
      await page.keyboard.type(article.free_content + '\n\n', { delay: 20 });
      await page.keyboard.type(article.paid_content, { delay: 10 });
      console.log('✅ 本文入力完了');
    } else {
      console.warn('⚠️ 本文エディタが見つかりませんでした');
    }

    await new Promise(r => setTimeout(r, 2000));

    // ⑤ 投稿設定（価格・タグ）は手動確認のためここで一時停止
    console.log('\n⚠️  価格・タグ設定を手動で行ってください');
    console.log(`   価格: ¥${article.price}`);
    console.log(`   タグ: ${article.tags.join(', ')}`);
    console.log('   30秒後に自動でブラウザを閉じます...');

    await new Promise(r => setTimeout(r, 30000));
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
