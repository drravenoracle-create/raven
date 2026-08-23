# Instagram Reel reconciliation 運用手順

## 自動で確定してよい状態

- `ERROR` は `failed` として保存する。
- `EXPIRED` は `failed` として保存する。
- `PUBLISHED`かつMetaレスポンスに確実な`media_id`がある場合だけ`published`として保存する。

## 自動で再投稿してはいけない状態

- `publishing`
- `PUBLISHED`だが`media_id`がない
- `FINISHED`だがpublish結果が不明
- `IN_PROGRESS`
- Meta status確認がHTTPエラーまたは不明な状態
- `external_post_id`が既に存在する投稿

これらは`reconciliation_required`として管理画面で人間確認する。

## 人間確認の手順

1. 管理画面の「要確認」で投稿ID、container ID、最終確認時刻、Meta status、error code/subcode、retry回数、理由を確認する。
2. 同じcontainer IDをMeta側で再確認する。
3. Meta側の公開結果とmedia IDを確実に特定できた場合だけ、公開済みとして記録する。
4. 公開結果を確定できない場合は再投稿せず、既存containerの扱いを保留する。
5. `ERROR`または`EXPIRED`で、外部media IDがなく、既存containerを再利用できないと確認できた場合だけ、新規投稿を作成する。

## 二重投稿防止

`container_id`がある投稿に対して新規containerを作らない。`publishing`または`reconciliation_required`の投稿へ自動で`media_publish`を再実行しない。公開済み判定は`external_post_id`または確実なmedia IDの保存を伴う場合に限定する。
