# Agent Usage HUD

Antigravity・Codex・Meta Muse の残りクレジット／クォータを Stream Deck 風のコンパクトな最前面ウィンドウで常時表示する Windows 向け Electron アプリです。

## 特徴
- **常に最前面表示 (Always on Top)**・枠なし・透過・どこでもドラッグ移動可能・位置自動記憶
- **Stream Deck 風の横並びタイルUI**（アイコン + 週間残% + `5h XX%` + 残量バー）
- **ライト / ダークテーマ**、サイズ（S / M / L）、不透明度、更新間隔をカスタマイズ可能
- **タスクトレイ常駐**・右クリックメニューですぐ更新／設定／終了

## 起動方法

```powershell
npm install
npm start
```

## 各サービスの連携方法

### 1. Codex
ローカルの `%USERPROFILE%\.codex\auth.json` を自動読み込みし、5時間枠と週間枠の残量（%）を取得します。

### 2. Antigravity
公式の Antigravity CLI (`agy`) を呼び出して残量を取得します（既定: `agy -p /usage --output-format json`）。
- `agy` が PATH にない場合は、設定画面から実行ファイルパスまたはカスタム取得コマンドを指定できます。

### 3. Meta Muse (`muse.ai`)
設定画面の **「Muse にログイン (muse.ai)」** をクリックして専用ブラウザでサインインすると、アプリ内の永続セッションを使って残量を取得します。
（将来的に Muse Code CLI の `~/.config/muse/auth.json` が存在する場合はそちらも自動検出します）
