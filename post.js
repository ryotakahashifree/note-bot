// post.js - Puppeteerを使ってNote.comに記事を自動投稿する
require('dotenv').config({ path: '../n8n/.env' });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
puppeteer.use(StealthPlugin());

const NOTE_EMAIL = process.env.NOTE_EMAIL;
const NOTE_PASSWORD = process.env.NOTE_PASSWORD;

// 残ったマークダウン記号を除去する保険
function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/\*(.*?)\*/gs, '$1')
    .replace(/_{2}(.*?)_{2}/gs, '$1')
    .trim();
}

// Pollinations.ai で無料スピリチュアル画像を生成・ダウンロード（最大3回リトライ）
async function downloadSpiritualImage(imagePrompt) {
  const savePath = path.join('d:/claudecode/note-bot', 'cover-image.jpg');
  const fullPrompt = imagePrompt + ', no text, no watermark, high quality, 4k';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const seed = Date.now() + attempt;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1280&height=720&nologo=true&seed=${seed}&model=flux`;
      console.log(`🎨 スピリチュアル画像を生成中... (試行 ${attempt}/3)`);
      const response = await axios({ url, responseType: 'stream', timeout: 90000 });
      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log('✅ 画像生成完了:', savePath);
      return savePath;
    } catch (e) {
      console.warn(`⚠️ 画像生成 試行${attempt} 失敗: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
    }
  }
  return null;
}

async function postToNote(article) {
  console.log('🚀 Note.com への投稿を開始します...');

  // 画像生成（並列で実行）
  let imagePath = null;
  if (article.image_prompt) {
    try {
      imagePath = await downloadSpiritualImage(article.image_prompt);
    } catch (e) {
      console.warn('⚠️ 画像生成スキップ:', e.message);
    }
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();

    // ① ログイン
    console.log('🔑 ログイン中...');
    await page.goto('https://note.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // メールアドレス入力
    const emailSelectors = [
      '.o-login__mailField input',
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="メール"]',
    ];
    let emailInput = null;
    for (const sel of emailSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        emailInput = sel;
        console.log('✅ メール入力フィールド発見:', sel);
        break;
      } catch { /* 次を試す */ }
    }
    if (!emailInput) {
      await page.screenshot({ path: 'd:/claudecode/note-bot/debug-error.png' });
      throw new Error('メール入力フィールドが見つかりません');
    }

    await page.click(emailInput);
    await page.type(emailInput, NOTE_EMAIL, { delay: 50 });
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.type('input[type="password"]', NOTE_PASSWORD, { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    console.log('✅ ログイン完了');

    // ② 新規記事作成ページへ
    console.log('📝 新規記事作成ページへ移動...');
    await page.goto('https://note.com/new', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // ③ カバー画像アップロード（ファイル入力を探す）
    if (imagePath) {
      try {
        const fileInputs = await page.$$('input[type="file"]');
        if (fileInputs.length > 0) {
          await fileInputs[0].uploadFile(imagePath);
          console.log('✅ カバー画像アップロード完了');
          await new Promise(r => setTimeout(r, 2000));
        } else {
          console.warn('⚠️ ファイル入力が見つかりません。画像は手動でアップロードしてください:', imagePath);
        }
      } catch (e) {
        console.warn('⚠️ 画像アップロードスキップ:', e.message, '\n   画像パス:', imagePath);
      }
    }

    // ④ タイトル入力
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
      console.warn('⚠️ タイトルフィールドが見つかりません');
    }

    // ⑤ 本文入力（マークダウン記号を念のためクリーニング）
    await new Promise(r => setTimeout(r, 1000));
    const bodySelectors = ['.ProseMirror', '[contenteditable="true"]', '.editor-body'];
    let bodyInput = null;
    for (const sel of bodySelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        bodyInput = sel;
        break;
      } catch {}
    }
    if (bodyInput) {
      const lead = stripMarkdown(article.lead);
      const freeContent = stripMarkdown(article.free_content);
      const paidContent = stripMarkdown(article.paid_content);

      await page.click(bodyInput);
      await page.keyboard.type(lead + '\n\n', { delay: 20 });
      await page.keyboard.type(freeContent + '\n\n', { delay: 10 });
      await page.keyboard.type(paidContent, { delay: 5 });
      console.log('✅ 本文入力完了');
    } else {
      console.warn('⚠️ 本文エディタが見つかりません');
    }

    await new Promise(r => setTimeout(r, 2000));

    // ⑥ 手動設定待ち
    console.log('\n⚠️  以下を手動で設定してください:');
    console.log(`   💰 価格: ¥${article.price} を設定して公開`);
    console.log(`   🏷️  タグ: ${article.tags.join(', ')}`);
    if (imagePath) console.log(`   🖼️  画像: ${imagePath} （自動アップロード試行済み）`);
    console.log('   30秒後にブラウザを閉じます...');

    await new Promise(r => setTimeout(r, 30000));
    console.log('✅ 完了');

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
    free_content: '✨【あなたの潜在意識はメッセージを送っています】✨\n\n（サンプルテキスト）',
    paid_content: '🔮【詳細リーディング】🔮\n\n（サンプルテキスト）',
    tags: ['スピリチュアル', '占い', '引き寄せの法則'],
    price: 500,
    image_prompt: 'ethereal spiritual woman, purple golden divine light, sacred geometry, mystical cosmic background'
  };
  postToNote(sampleArticle).catch(console.error);
}
