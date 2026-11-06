// โชว์ผลงานบนทีวี (6 Nov 2026): Facebook page posts, website news as the fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromFacebook, fromWebsite, headline } from "@/lib/monitor/showcase";

const SITE_HTML = `<a href="detail_newspr.php?id_newspr=2212" '="" target="_blank">
<div id="zzz"><div id="pic_pr_news"><img src="images_newspr/newspr_1793260696_0.jpg" width="150px"></div>
<div id="text_pr_news"><img src="images/icon_b.png" width="13px"> <b>พิธีตักบาตรเทโวโรหณะ ยอดเขาดาวดึงส์ วัดคีรีวงศ์</b>
<div id="subdetail">วันพุธที่ 28 ตุลาคม 2569 ...</div></div></div>
<div style="text-align: right;">29/10/2569</div></a>
<a href="detail_newspr.php?id_newspr=2211" target="_blank"><div><img src="images_newspr/newspr_1793260562_0.jpg"></div><b>ผู้บริหาร สท. ร่วมพูดคุย อสม. &amp; ชุมชน</b><div>28/10/2569</div></a>`;

const RAW = `<li class='first'><a href=detail_newspr.php?id_newspr=2212 ' target='_blank' >
<div id='zzz' style='width: 650px; height: 115px;'>
<div id='pic_pr_news' style='float: left; width: 150px;'>
<img src='images_newspr/newspr_1793260696_0.jpg' width='150px' height='113px' />
</div>
<div id='text_pr_news' style='margin-left: 5px; float: left; width: 480px;'>
<img src='images/icon_b.png' width='13px' />
<b>พิธีตักบาตรเทโวโรหณะ ยอดเขาดาวดึงส์ วัดคีรีวงศ์</b>
<div id='subdetail'>วันพุธที่ 28 ตุลาคม 2569</div></div></div>
<div style='text-align: right;'>29/10/2569</div></a></li>`;

test("the site's real markup (unquoted / single quotes), no duplicates", () => {
  const items = fromWebsite(RAW + RAW);
  assert.equal(items.length, 1);
  assert.equal(items[0].image, "https://www.nsm.go.th/images_newspr/newspr_1793260696_0.jpg");
  assert.equal(items[0].title, "พิธีตักบาตรเทโวโรหณะ ยอดเขาดาวดึงส์ วัดคีรีวงศ์");
});

test("website news list → photo, title, date", () => {
  const items = fromWebsite(SITE_HTML);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { title: "พิธีตักบาตรเทโวโรหณะ ยอดเขาดาวดึงส์ วัดคีรีวงศ์", image: "https://www.nsm.go.th/images_newspr/newspr_1793260696_0.jpg", date: "2026-10-29", source: "website" });
  assert.equal(items[1].title, "ผู้บริหาร สท. ร่วมพูดคุย อสม. & ชุมชน");
  assert.deepEqual(fromWebsite("<html>maintenance</html>"), []);
});

test("facebook posts: only ones with a photo and words, first real line as the title", () => {
  const items = fromFacebook({ data: [
    { message: "🎉🎉\n#เทศบาลนครนครสวรรค์ จัดงานลอยกระทง\nรายละเอียด...", full_picture: "https://scontent.example/a.jpg", created_time: "2026-11-05T10:00:00+0000" },
    { message: "ไม่มีรูป", created_time: "2026-11-04T10:00:00+0000" },
    { full_picture: "https://scontent.example/b.jpg" },
  ] });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "#เทศบาลนครนครสวรรค์ จัดงานลอยกระทง");
  assert.equal(items[0].date, "2026-11-05");
  assert.deepEqual(fromFacebook(null), []);
  assert.equal(headline("ก".repeat(200)).length, 90);
});
