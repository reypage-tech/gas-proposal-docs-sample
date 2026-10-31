# Google Docs proposals from CRM rows (Apps Script sample)

![Proposal cover (Bluestone example, page 1)](examples/proposal_bluestone-1.png)

Replaces copying each deal into a proposal by hand with one sheet row that fills 13 fields into a 5-page proposal Doc and PDF.

For a land-survey firm's sales staff: instead of copying each deal from the CRM sheet into a proposal by hand, the script builds the five-page proposal Doc and its PDF from that sheet row.

![Proposal costs page (Bluestone example, page 5)](examples/proposal_bluestone-5.png)

Tests: 32 of 32 pass with `npm test`.

## Template Doc
[Make a copy of the template Doc](https://docs.google.com/document/d/1EOYhbxU17O6odZ4I0zbC8TstZzIurqL5l8Znvx_WsAc/copy) (Google Docs asks you to save your own copy). It holds every tag in the table below in place of the values. Replace "Your Survey Company" with your company name, then put your copy's Doc ID in `CONFIG.TEMPLATE_ID` in `src/Code.gs`.

## Template tags and the 13 fields in the posting
| # | Field in the posting | Template tag(s) | Example |
|---|---|---|---|
| 1 | Cover page contact details | `{{ClientName}}` `{{ContactName}}` `{{ContactEmail}}` `{{ContactPhone}}` `{{Address}}` | [page 1](examples/proposal_bluestone-1.png) |
| 2 | Scope of work | `{{ScopeOfWork}}` | [page 2](examples/proposal_bluestone-2.png) |
| 3 | Areas to be surveyed (bulleted list and images) | `{{List:SurveyAreas}}` `{{Image:SurveyImages}}` | [page 2](examples/proposal_bluestone-2.png) |
| 4 | Equipment | `{{List:Equipment}}` | [page 2](examples/proposal_bluestone-2.png) |
| 5 | Site Photos | `{{Image:SitePhotos}}` | [page 3](examples/proposal_bluestone-3.png) |
| 6 | Deliverables list | `{{List:Deliverables}}` | [page 3](examples/proposal_bluestone-3.png) |
| 7 | Plan sheets included | `{{List:PlanSheets}}` | [page 3](examples/proposal_bluestone-3.png) |
| 8 | Deliverable example images | `{{Image:DeliverableImages}}` | [page 4](examples/proposal_bluestone-4.png) |
| 9 | Plan Sheet Details included/excluded lists | `{{List:Included}}` `{{List:Excluded}}` | [page 4](examples/proposal_bluestone-4.png) |
| 10 | Checkbox options for orthogonal and True geometry | `{{Check:Orthogonal}}` `{{Check:TrueGeometry}}` | [page 4](examples/proposal_bluestone-4.png) |
| 11 | Project Costs | `{{LineItems}}` `{{Subtotal}}` `{{Tax}}` `{{Total}}` | [page 5](examples/proposal_bluestone-5.png) |
| 12 | Complimentary Services | `{{List:ComplimentaryServices}}` | [page 5](examples/proposal_bluestone-5.png) |
| 13 | Proposal-specific terms | `{{Terms}}` or `{{List:Terms}}` | [page 5](examples/proposal_bluestone-5.png) |

Example output for two survey firms: [Bluestone PDF](examples/proposal_bluestone.pdf) (pages [1](examples/proposal_bluestone-1.png) [2](examples/proposal_bluestone-2.png) [3](examples/proposal_bluestone-3.png) [4](examples/proposal_bluestone-4.png) [5](examples/proposal_bluestone-5.png)), [Meadowfield PDF](examples/proposal_meadowfield.pdf) (pages [1](examples/proposal_meadowfield-1.png) [2](examples/proposal_meadowfield-2.png) [3](examples/proposal_meadowfield-3.png) [4](examples/proposal_meadowfield-4.png) [5](examples/proposal_meadowfield-5.png)).

These pages are a reproduction of how it looks in Google Docs. They were laid out in HTML/CSS and printed to PDF by `examples/build.py`. The client's attached example PDF has not been seen, so this layout is not a copy of it. The layout will be rebuilt to match the example the client provides, with their graphics in the sizes and places they give.

## How it works
Each deal row in a Google Sheet becomes a proposal made from one Google Docs template. The script fills text tags, bullet lists, images from Drive, ☑/☐ checkboxes and a priced line-item table, saves a PDF in a Drive folder, and writes the Doc link, PDF link and status back to the row. Rerunning a row updates the same Doc. Rows with missing fields are skipped with a reason. An optional Gmail draft is off by default and mail is never sent.

## 概要
CRMから出した案件の行（シート）を1件ずつ読み、Google Docsのひな形1つから提案書を作ります。文字、箇条書き、Driveの画像、☑/☐ のチェック欄、金額の表を差し込み、PDFをDriveのフォルダに保存し、行にURLと状態を書き戻します。

## 仕組み
1. `Deals` シートの行を上から読む
2. 必須項目と明細を確かめる。足りなければ `Skipped` と理由を書いて次へ
3. ひな形を作業用にコピーし、タグを埋める
4. 作業用の文書からPDFを作る
5. 文書とPDFの両方ができてから、古いものに手をつける
   - 前回の `DocUrl` があれば、その文書の本文を消して作業用の中身を写す（URLはそのまま）。作業用はゴミ箱へ
   - PDFは新しく保存してから古いPDFをゴミ箱へ（Advanced Drive を使う設定なら同じファイルの中身を差し替え）
6. 途中で失敗したら作業用だけをゴミ箱へ移し、古い文書とPDFはそのまま。行は `Error` と理由
7. `DocUrl` `PdfUrl` `Status` `Note` `UpdatedAt` を行に書き戻す

## シートの列
**Deals**（1行目が見出し）

| 列 | 必須 | 内容 |
|---|---|---|
| DealId | はい | 案件ID。重複した2行目以降は `Skipped` |
| ClientName | はい | 宛先の会社名 |
| ServiceType | はい | サービス名 |
| ContactName, ContactEmail, ContactPhone, Address | | 表紙の連絡先 |
| ScopeOfWork, Terms | | 文 |
| SurveyAreas, Equipment, Deliverables, PlanSheets, Included, Excluded, ComplimentaryServices | | 箇条書き。改行か `;` で区切る |
| SurveyImages, SitePhotos, DeliverableImages | | DriveのファイルIDかURL。改行か `;` で区切る |
| Orthogonal, TrueGeometry | | yes / true / x / 1 なら ☑、ほかは ☐ |
| ValidUntil | | 日付（script の時間帯で yyyy-MM-dd） |
| DocUrl, PdfUrl, Status, Note, UpdatedAt | | スクリプトが書く。なければ見出しを足します |

列名は自由に足せます。上の名前は、最初の表の13項目に合わせた例です。

**LineItems**: `DealId, Item, Qty, UnitPrice`（Qtyは0より大きい数、UnitPriceは0以上）

**Log**（任意）: 1回ごとに `日時, 作成数, スキップ数, エラー数` を1行足します。

## 差し込みタグ
| タグ | 中身 |
|---|---|
| `{{列名}}` | Deals の同じ名前の列の文字 |
| `{{List:列名}}` | その列を箇条書きに。値が空ならタグの行ごと消す |
| `{{Image:列名}}` | その列のDrive画像を順に入れる。幅は `IMAGE_WIDTH`（450pt）まで縮める |
| `{{Check:列名}}` | ☑ か ☐ |
| `{{Subtotal}}` `{{Tax}}` `{{Total}}` | 明細から計算（例 `$699.50`） |
| `{{Today}}` | 作成日（script の時間帯） |
| `{{LineItems}}` | 明細の表（Item / Qty / Unit price / Amount） |

箇条書き・画像・表のタグの置き方:
- タグだけの段落（または箇条書きの1行）なら、その段落と入れ替え
- 同じ段落にほかの文字があれば、タグの文字だけ消して、その段落のすぐ後に入れる
- 表のマスの中にあるときは、その表のすぐ後に入れる
- `{{LineItems}}` がひな形にないときは、最後に表を足し、Note に `No {{LineItems}} tag, added at the end` と書く

## 設定手順
1. シートに `Deals` `LineItems` `Log` を作る（`sample_data/` のCSVを読み込めます。`PUT_DRIVE_FILE_ID_*` は自分の画像のIDに）
2. 上のタグを入れたDocsのひな形を作り、IDを控える
3. 出力先のDriveフォルダを作り、IDを控える
4. 拡張機能 > Apps Script に `src/Code.gs` を貼る
5. `CONFIG` の `TEMPLATE_ID` `FOLDER_ID` `TAX_RATE` `CURRENCY` `IMAGE_WIDTH` を書き換える
6. 作り直しでもPDFのURLを変えたくないなら、サービスに Drive API（Advanced Drive）を足して `USE_ADVANCED_DRIVE: true`
7. 下書きが要るなら `CREATE_DRAFT: true`（求人本文はメールに触れていないので初期は切ってあります）
8. プロジェクトの設定で時間帯を確かめる（日付はこの時間帯で読みます）
9. シートを開き直し、メニュー「Proposals > Generate proposals」を実行。初回は権限の確認が出ます

## この見本でしないこと・限界
- メールは送りません。`CREATE_DRAFT` のときも Gmail の下書きを作るだけです
- CRMのAPIにはつなぎません（CSVをシートに貼る前提）
- ひな形は1つです
- 作り直すとDocsの本文を写し直すので、Docs上で手で直した所は消えます
- 文書のURLは作り直しても変わりません。PDFのURLは、`USE_ADVANCED_DRIVE` が切ってあると作り直すたびに変わります（古いPDFはゴミ箱へ）
- 画像は行の中に置く形です。見た目と画像の位置は、依頼主から届く見本に合わせて作り直します（見本PDFはまだ見ていません）
- 本文の写し直しは段落・箇条書き・表を写します。ヘッダー・フッターはひな形のものが作業用にだけ残るので、ヘッダーにタグは置かないでください
- 文書を写す途中で止まった場合、古い文書が途中までの中身になることがあります（PDFは新しいもの）。行は `Error` になるので、もう一度実行してください
- 1回の実行時間の上限（6分）を超える件数は分けて実行してください

## テスト
```
npm test
```
Node 18 以上（`node --test test/*.test.js`）。32件すべて合格。

Note: built and tested with fictional data and local mocks; example output was rendered by `examples/build.py`; not yet run in a real Google Sheets or Apps Script project.
