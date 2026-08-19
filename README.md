# ポケモン なまえクイズ（子ども向けWebアプリ）

## ファイル
- index.html
- style.css
- app.js

## ローカルで試す
このフォルダで次を実行:

```bash
py -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## GitHub Pagesで公開
1. GitHubで新しいリポジトリを作成
2. index.html / style.css / app.js をアップロード
3. Settings → Pages
4. Deploy from a branch
5. main / (root) を選択
6. 表示されたURLを開く

## 機能
- 第1〜9世代をチェックボックスで選択
- 選択世代だけから10問出題
- 4択名前クイズ
- 終了後に問題・正解・自分の答えを一覧表示
- No.1〜1025の図鑑
- 図鑑番号ジャンプ
- 名前を隠す暗記モード
- スマホ・タブレット対応

## データ
名前は PokéAPI の pokemon-species API から取得し、localStorage にキャッシュします。
画像は PokeAPI/sprites の official-artwork を使い、失敗時は通常スプライトへ切り替えます。

## 注意
公開時は、ポケモン関連の名称・画像など第三者の知的財産の利用条件を別途確認してください。
