// index.js - Note bot メインエントリーポイント
// 実行: node index.js
require('dotenv').config({ path: '../n8n/.env' });
const { generateArticle } = require('./generate');
const { postToNote } = require('./post');

async function run() {
  console.log('========================================');
  console.log('  Note.com スピリチュアル bot 起動');
  console.log('  ' + new Date().toLocaleString('ja-JP'));
  console.log('========================================\n');

  try {
    // Step 1: 記事生成
    console.log('【Step 1】Gemini で記事を生成中...');
    const article = await generateArticle();
    console.log('生成タイトル:', article.title);
    console.log('価格: ¥' + article.price);
    console.log('タグ:', article.tags.join(', '));
    console.log('');

    // Step 2: Note.com に投稿
    console.log('【Step 2】Note.com に投稿中...');
    await postToNote(article);

    console.log('\n✅ 完了！今日の記事を投稿しました。');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

run();
