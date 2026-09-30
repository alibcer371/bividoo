const urlInput = document.getElementById("socialVideoURL");
const findBtn = document.getElementById("findVideoButton");
const typeSel = document.getElementById("linkType");
const qualitySel = document.getElementById("linkQuality");
const qualityLabel = document.getElementById("qualityLabel");
const linkDownloadBtn = document.getElementById("linkDownloadButton");
const statusBox = document.getElementById("linkStatus");

const linkPreview = document.getElementById("linkPreview");
const youtubePreview = document.getElementById("youtubePreview");

const platformPreview =
  document.getElementById("platformPreview");

const platformPreviewIcon =
  document.getElementById("platformPreviewIcon");

const platformPreviewTitle =
  document.getElementById("platformPreviewTitle");

const platformPreviewText =
  document.getElementById("platformPreviewText");


let linkReady = false;
let currentLinkKind = "";
let currentURL = "";


/* =========================================
   DURUM MESAJI
========================================= */

function showStatus(message) {
  statusBox.classList.add("show");
  statusBox.textContent = message;
}


/* =========================================
   ÖNİZLEMEYİ SIFIRLA
========================================= */

function resetPreview() {
  linkPreview.classList.remove("show");

  youtubePreview.classList.remove("show");
  youtubePreview.src = "";

  platformPreview.classList.remove("show");

  platformPreviewIcon.textContent = "🎬";
  platformPreviewTitle.textContent = "Video bağlantısı";
  platformPreviewText.textContent = "Bağlantı tanındı.";
}


/* =========================================
   İNDİRME BUTONU
========================================= */

function disableDownload() {
  linkReady = false;

  linkDownloadBtn.disabled = true;
  linkDownloadBtn.classList.remove("ready");
}


function enableDownload() {
  linkReady = true;

  linkDownloadBtn.disabled = false;
  linkDownloadBtn.classList.add("ready");
}


/* =========================================
   YOUTUBE ID
========================================= */

function getYouTubeID(value) {
  try {
    const parsed = new URL(value);

    const hostname =
      parsed.hostname
        .replace(/^www\./, "")
        .toLowerCase();


    if (hostname === "youtu.be") {
      return parsed.pathname
        .split("/")
        .filter(Boolean)[0] || null;
    }


    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com"
    ) {

      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }


      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);


      if (
        parts[0] === "shorts" ||
        parts[0] === "embed" ||
        parts[0] === "live"
      ) {
        return parts[1] || null;
      }
    }


    return null;
  }

  catch {
    return null;
  }
}


/* =========================================
   PLATFORM ALGILAMA
========================================= */

function getPlatform(value) {
  try {
    const parsed = new URL(value);

    const host =
      parsed.hostname
        .replace(/^www\./, "")
        .toLowerCase();


    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      return "youtube";
    }


    if (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com")
    ) {
      return "tiktok";
    }


    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    ) {
      return "instagram";
    }


    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch"
    ) {
      return "facebook";
    }


    return "direct";
  }

  catch {
    return "";
  }
}


/* =========================================
   PLATFORM ÖNİZLEME
========================================= */

function showPlatformPreview(
  icon,
  title,
  text
) {
  resetPreview();

  linkPreview.classList.add("show");
  platformPreview.classList.add("show");

  platformPreviewIcon.textContent = icon;
  platformPreviewTitle.textContent = title;
  platformPreviewText.textContent = text;
}


/* =========================================
   YOUTUBE ÖNİZLEME
========================================= */

function showYouTubePreview(videoID) {
  resetPreview();

  linkPreview.classList.add("show");
  youtubePreview.classList.add("show");

  youtubePreview.src =
    `https://www.youtube.com/embed/${encodeURIComponent(videoID)}`;
}


/* =========================================
   LİNK KONTROLÜ
========================================= */

function checkVideoLink() {
  const value = urlInput.value.trim();

  disableDownload();
  resetPreview();

  currentURL = "";
  currentLinkKind = "";


  if (!value) {
    showStatus(
      "Önce video bağlantısını gir."
    );

    urlInput.focus();
    return;
  }


  let parsedURL;

  try {
    parsedURL = new URL(value);
  }

  catch {
    showStatus(
      "Geçerli bir video bağlantısı gir."
    );

    return;
  }


  if (
    parsedURL.protocol !== "http:" &&
    parsedURL.protocol !== "https:"
  ) {
    showStatus(
      "Yalnızca http veya https bağlantıları kullanılabilir."
    );

    return;
  }


  currentURL = parsedURL.href;

  const platform =
    getPlatform(currentURL);


  /* -----------------------------------------
     YOUTUBE
  ----------------------------------------- */

  if (platform === "youtube") {
    currentLinkKind = "youtube";

    const videoID =
      getYouTubeID(currentURL);


    if (videoID) {
      showYouTubePreview(videoID);

      showStatus(
        "YouTube videosu bulundu. Önizleme hazır. Bu bağlantı doğrudan video dosyası olmadığı için BiVidoo üzerinden MP4/MP3 indirme kullanılamaz."
      );
    }

    else {
      showPlatformPreview(
        "▶",
        "YouTube bağlantısı",
        "YouTube bağlantısı tanındı."
      );

      showStatus(
        "YouTube bağlantısı tanındı ancak video önizlemesi oluşturulamadı."
      );
    }

    return;
  }


  /* -----------------------------------------
     TIKTOK
  ----------------------------------------- */

  if (platform === "tiktok") {
    currentLinkKind = "platform";

    showPlatformPreview(
      "♪",
      "TikTok bağlantısı",
      "TikTok video sayfası tanındı."
    );

    showStatus(
      "TikTok bağlantısı tanındı. Bu bağlantı doğrudan video dosyası olmadığı için BiVidoo üzerinden indirme kullanılamaz."
    );

    return;
  }


  /* -----------------------------------------
     INSTAGRAM
  ----------------------------------------- */

  if (platform === "instagram") {
    currentLinkKind = "platform";

    showPlatformPreview(
      "◎",
      "Instagram bağlantısı",
      "Instagram video sayfası tanındı."
    );

    showStatus(
      "Instagram bağlantısı tanındı. Bu bağlantı doğrudan video dosyası olmadığı için BiVidoo üzerinden indirme kullanılamaz."
    );

    return;
  }


  /* -----------------------------------------
     FACEBOOK
  ----------------------------------------- */

  if (platform === "facebook") {
    currentLinkKind = "platform";

    showPlatformPreview(
      "f",
      "Facebook bağlantısı",
      "Facebook video sayfası tanındı."
    );

    showStatus(
      "Facebook bağlantısı tanındı. Bu bağlantı doğrudan video dosyası olmadığı için BiVidoo üzerinden indirme kullanılamaz."
    );

    return;
  }


  /* -----------------------------------------
     DOĞRUDAN VIDEO URL
  ----------------------------------------- */

  currentLinkKind = "direct";

  showPlatformPreview(
    "🎬",
    "Video bağlantısı hazır",
    "Doğrudan medya bağlantısı sunucu tarafından kontrol edilerek işlenecek."
  );

  enableDownload();

  showStatus(
    "Bağlantı hazır. İndirme türünü ve kaliteyi seçip İndir'e bas."
  );
}


/* =========================================
   MP3 / VIDEO KALİTE SEÇENEKLERİ
========================================= */

function updateQualityOptions() {
  const type = typeSel.value;


  if (type === "mp3") {
    qualityLabel.textContent =
      "Ses Kalitesi";

    qualitySel.innerHTML = `
      <option value="320">
        320 kbps
      </option>

      <option value="192" selected>
        192 kbps
      </option>

      <option value="128">
        128 kbps
      </option>
    `;

    return;
  }


  qualityLabel.textContent =
    "Video Kalitesi";

  qualitySel.innerHTML = `
    <option value="original">
      Orijinal
    </option>

    <option value="1080">
      1080p
    </option>

    <option value="720">
      720p
    </option>

    <option value="480">
      480p
    </option>
  `;
}


/* =========================================
   VİDEOYU BUL
========================================= */

findBtn.addEventListener(
  "click",
  checkVideoLink
);


urlInput.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Enter") {
      checkVideoLink();
    }
  }
);


/* =========================================
   LINK DEĞİŞİRSE ESKİ SONUCU İPTAL ET
========================================= */

urlInput.addEventListener(
  "input",
  function () {
    disableDownload();

    currentURL = "";
    currentLinkKind = "";

    resetPreview();

    statusBox.classList.remove("show");
  }
);


/* =========================================
   TÜR DEĞİŞTİRME
========================================= */

typeSel.addEventListener(
  "change",
  updateQualityOptions
);


/* =========================================
   İNDİR
========================================= */

linkDownloadBtn.addEventListener(
  "click",
  async function () {

    if (
      !linkReady ||
      currentLinkKind !== "direct" ||
      !currentURL
    ) {
      showStatus(
        "Bu bağlantı BiVidoo üzerinden doğrudan indirilemiyor."
      );

      return;
    }


    const type =
      typeSel.value;


    let quality =
      qualitySel.value;


    let audioBitrate =
      "192";


    if (type === "mp3") {
      audioBitrate = quality;
      quality = "original";
    }


    const originalText =
      linkDownloadBtn.textContent;


    try {
      linkDownloadBtn.disabled = true;

      linkDownloadBtn.textContent =
        "⏳ Hazırlanıyor...";


      showStatus(
        "Video sunucuya bağlanıyor ve hazırlanıyor..."
      );


      const response =
        await fetch(
"/api/process-url",          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              url: currentURL,
              type,
              quality,
              audioBitrate
            })
          }
        );


      if (!response.ok) {
        let errorMessage =
          "Video işlenemedi.";

        const responseText = await response.text();

try {
    const data = JSON.parse(responseText);

    if (data?.error) {
        errorMessage = data.error;
    } else if (responseText) {
        errorMessage = responseText;
    }
} catch {
    if (responseText) {
        errorMessage = responseText;
    }
}

        throw new Error(
          errorMessage
        );
      }


      const blob =
        await response.blob();


      const downloadURL =
        URL.createObjectURL(blob);


      const anchor =
        document.createElement("a");


      anchor.href =
        downloadURL;


      if (type === "mp3") {
        anchor.download =
          "bividoo-audio.mp3";
      }

      else if (type === "mute") {
        anchor.download =
          "bividoo-sessiz.mp4";
      }

      else {
        anchor.download =
          "bividoo-video.mp4";
      }


      document.body.appendChild(
        anchor
      );


      anchor.click();


      anchor.remove();


      setTimeout(
        function () {
          URL.revokeObjectURL(
            downloadURL
          );
        },
        5000
      );


      showStatus(
        "✓ İşlem tamamlandı. Dosyan indiriliyor."
      );
    }

    catch (error) {
      console.error(error);

      showStatus(
        "İşlem başarısız: " +
        (
          error?.message ||
          "Sunucuya bağlanılamadı."
        )
      );
    }

    finally {
      linkDownloadBtn.disabled =
        false;

      linkDownloadBtn.textContent =
        originalText;

      linkDownloadBtn.classList.add(
        "ready"
      );
    }
  }
);


/* =========================================
   BAŞLANGIÇ
========================================= */

updateQualityOptions();
disableDownload();
resetPreview();