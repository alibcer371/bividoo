import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/* =========================================
   BIVIDOO
========================================= */

const videoInput = document.getElementById("videoInput");
const videoPanel = document.getElementById("videoPanel");
const dropZone = document.getElementById("dropZone");
const toolElements = document.querySelectorAll(".tool");

const ffmpeg = new FFmpeg();

let ffmpegLoaded = false;
let ffmpegLoading = false;

let selectedFile = null;
let previewURL = null;
let downloadURL = null;

let selectedTool = "convert";

let videoDuration = 0;
let videoWidth = 0;
let videoHeight = 0;

let processing = false;


/* =========================================
   ARAÇ BİLGİLERİ
========================================= */

const toolConfig = {
  convert: {
    name: "MP4'e Dönüştür",
    icon: "🔄",
    working: "MP4'e dönüştürülüyor...",
    title: "Video dönüştürülüyor..."
  },

  mp3: {
    name: "MP3'e Dönüştür",
    icon: "🎵",
    working: "MP3 hazırlanıyor...",
    title: "Ses dosyası hazırlanıyor..."
  },

  compress: {
    name: "Videoyu Sıkıştır",
    icon: "📦",
    working: "Video sıkıştırılıyor...",
    title: "Video sıkıştırılıyor..."
  },

  trim: {
    name: "Videoyu Kırp",
    icon: "✂️",
    working: "Video kırpılıyor...",
    title: "Video kırpılıyor..."
  },

  resize: {
    name: "Videoyu Boyutlandır",
    icon: "↔️",
    working: "Video boyutlandırılıyor...",
    title: "Video boyutlandırılıyor..."
  }
};


/* =========================================
   FFMPEG İLERLEME
========================================= */

ffmpeg.on("progress", ({ progress }) => {
  if (!processing) return;

  const percent = Math.max(
    0,
    Math.min(100, Math.round(progress * 100))
  );

  setProgress(percent);
});


/* =========================================
   FFMPEG YÜKLE
========================================= */

async function loadFFmpeg() {
  if (ffmpegLoaded) return;

  if (ffmpegLoading) {
    while (!ffmpegLoaded && ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (ffmpegLoaded) return;
  }

  ffmpegLoading = true;

  updateProgressText(
    "Video motoru ilk kez hazırlanıyor..."
  );

  try {
    const baseURL =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript"
      ),

      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      )
    });

    ffmpegLoaded = true;

  } finally {
    ffmpegLoading = false;
  }
}


/* =========================================
   DOSYA SEÇ
========================================= */

videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];

  if (file) {
    prepareVideo(file);
  }
});


async function prepareVideo(file) {
  if (
    file.type &&
    !file.type.startsWith("video/")
  ) {
    alert("Lütfen bir video dosyası seç.");
    return;
  }

  selectedFile = file;

  clearDownloadURL();

  if (previewURL) {
    URL.revokeObjectURL(previewURL);
  }

  previewURL = URL.createObjectURL(file);

  try {
    const metadata =
      await readVideoMetadata(previewURL);

    videoDuration = metadata.duration;
    videoWidth = metadata.width;
    videoHeight = metadata.height;

    renderVideoPanel();

  } catch (error) {
    console.error(error);

    alert(
      "Video bilgileri okunamadı. Başka bir video dene."
    );
  }
}


/* =========================================
   VIDEO BİLGİLERİ
========================================= */

function readVideoMetadata(url) {
  return new Promise((resolve, reject) => {
    const video =
      document.createElement("video");

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    video.onerror = reject;
    video.src = url;
  });
}


/* =========================================
   VIDEO PANELİ
========================================= */

function renderVideoPanel() {
  if (!selectedFile) {
    renderEmptyPanel();
    return;
  }

  const sizeMB =
    bytesToMB(selectedFile.size);

  const format =
    (getExtension(selectedFile.name) || "VIDEO")
      .toUpperCase();

  videoPanel.innerHTML = `
    <div class="video-panel-title">

      <h2>Seçilen Video</h2>

      <button
        class="remove-button"
        id="removeVideo"
        type="button"
      >
        🗑 Kaldır
      </button>

    </div>

    <div class="video-info-grid">

      <video
        class="video-preview"
        src="${previewURL}"
        controls
      ></video>

      <div class="file-info">

        ${infoRow(
          "📄",
          "Dosya Adı",
          escapeHTML(selectedFile.name)
        )}

        ${infoRow(
          "◷",
          "Süre",
          formatDuration(videoDuration)
        )}

        ${infoRow(
          "📁",
          "Boyut",
          `${sizeMB} MB`
        )}

        ${infoRow(
          "▣",
          "Çözünürlük",
          `${videoWidth} × ${videoHeight}`
        )}

        ${infoRow(
          "🎞",
          "Format",
          format
        )}

      </div>

    </div>

    <div
      class="operation-options"
      id="operationOptions"
    ></div>

    <div
      class="progress-box"
      id="progressBox"
    >

      <div class="progress-head">

        <strong id="progressTitle">
          Video hazırlanıyor...
        </strong>

        <strong id="progressPercent">
          0%
        </strong>

      </div>

      <div class="progress-track">

        <div
          class="progress-bar"
          id="progressBar"
        ></div>

      </div>

      <div
        class="progress-text"
        id="progressText"
      >
        İşlem bekleniyor.
      </div>

    </div>

    <button
      class="action-button"
      id="actionButton"
      type="button"
    ></button>

    <a
      class="download-button"
      id="downloadButton"
    >
      ⬇ Dosyayı İndir
    </a>

    <div class="privacy">
      🛡️ İşlem cihazınızda yapılır.
      Videonuz BiVidoo sunucusuna yüklenmez.
    </div>
  `;

  document
    .getElementById("removeVideo")
    .addEventListener(
      "click",
      removeVideo
    );

  document
    .getElementById("actionButton")
    .addEventListener(
      "click",
      processSelectedTool
    );

  renderSelectedTool();
}


function renderEmptyPanel() {
  videoPanel.innerHTML = `
    <div class="video-panel-title">
      <h2>Seçilen Video</h2>
    </div>

    <div class="empty-video">
      <div>
        🎬
        <br><br>
        Henüz video seçilmedi.
        <br>
        Sol taraftan bir video seç.
      </div>
    </div>
  `;
}


/* =========================================
   BİLGİ SATIRI
========================================= */

function infoRow(icon, label, value) {
  return `
    <div class="info-row">

      <span>${icon}</span>

      <strong>${label}</strong>

      <span
        class="info-value"
        title="${value}"
      >
        ${value}
      </span>

    </div>
  `;
}


/* =========================================
   ARAÇ SEÇİMİ
========================================= */

toolElements.forEach(tool => {
  tool.addEventListener("click", () => {
    if (processing) return;

    selectedTool =
      tool.dataset.tool;

    toolElements.forEach(item => {
      item.classList.remove("active");
    });

    tool.classList.add("active");

    if (!selectedFile) {
      videoInput.click();
      return;
    }

    renderSelectedTool();

    videoPanel.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });
});


/* =========================================
   SEÇİLEN ARACIN AYARLARI
========================================= */

function renderSelectedTool() {
  if (!selectedFile) return;

  const config =
    toolConfig[selectedTool];

  const button =
    document.getElementById(
      "actionButton"
    );

  const options =
    document.getElementById(
      "operationOptions"
    );

  const download =
    document.getElementById(
      "downloadButton"
    );

  const progress =
    document.getElementById(
      "progressBox"
    );

  if (!button || !options) return;

  button.disabled = false;

  button.textContent =
    `${config.icon} ${config.name}`;

  download?.classList.remove("show");
  progress?.classList.remove("show");

  clearDownloadURL();

  options.innerHTML = "";
  options.classList.remove("show");


  /* SIKIŞTIRMA */

  if (selectedTool === "compress") {
    options.innerHTML = `
      <div class="options-title">
        Sıkıştırma Seviyesi
      </div>

      <div class="option-field">

        <label>
          Kalite / Dosya Boyutu
        </label>

        <select id="compressLevel">

          <option value="24">
            Yüksek kalite — daha büyük dosya
          </option>

          <option value="28" selected>
            Dengeli — önerilen
          </option>

          <option value="32">
            Güçlü sıkıştırma — daha küçük dosya
          </option>

        </select>

      </div>
    `;

    options.classList.add("show");
  }


  /* KIRPMA */

  if (selectedTool === "trim") {
    const max =
      Math.max(
        1,
        Math.floor(videoDuration)
      );

    options.innerHTML = `
      <div class="options-title">
        Kırpılacak Bölüm
      </div>

      <div class="option-grid">

        <div class="option-field">

          <label>
            Başlangıç — saniye
          </label>

          <input
            id="trimStart"
            type="number"
            min="0"
            max="${max}"
            step="0.1"
            value="0"
          >

        </div>

        <div class="option-field">

          <label>
            Bitiş — saniye
          </label>

          <input
            id="trimEnd"
            type="number"
            min="0.1"
            max="${max}"
            step="0.1"
            value="${max}"
          >

        </div>

      </div>
    `;

    options.classList.add("show");
  }


  /* BOYUTLANDIRMA */

  if (selectedTool === "resize") {
    options.innerHTML = `
      <div class="options-title">
        Video Boyutu
      </div>

      <div class="option-grid">

        <div class="option-field">

          <label>
            Hedef format
          </label>

          <select id="resizePreset">

            <option value="vertical">
              9:16 — Shorts / Reels / TikTok
            </option>

            <option value="square">
              1:1 — Kare
            </option>

            <option value="landscape">
              16:9 — YouTube / Yatay
            </option>

          </select>

        </div>


        <div class="option-field">

          <label>
            Görüntü biçimi
          </label>

          <select id="resizeMode">

            <option value="fill" selected>
              Ekranı Doldur — boşluk bırakma
            </option>

            <option value="fit">
              Sığdır — görüntünün tamamını koru
            </option>

          </select>

        </div>

      </div>
    `;

    options.classList.add("show");
  }
}


/* =========================================
   İŞLEM YÖNLENDİRİCİ
========================================= */

async function processSelectedTool() {
  if (!selectedFile || processing) return;

  switch (selectedTool) {
    case "convert":
      await convertToMP4();
      break;

    case "mp3":
      await convertToMP3();
      break;

    case "compress":
      await compressVideo();
      break;

    case "trim":
      await trimVideo();
      break;

    case "resize":
      await resizeVideo();
      break;
  }
}


/* =========================================
   İŞLEM BAŞLANGICI
========================================= */

function beginProcess() {
  processing = true;

  clearDownloadURL();

  const progressBox =
    document.getElementById(
      "progressBox"
    );

  const download =
    document.getElementById(
      "downloadButton"
    );

  const button =
    document.getElementById(
      "actionButton"
    );

  progressBox?.classList.add("show");
  download?.classList.remove("show");

  if (button) {
    button.disabled = true;

    button.textContent =
      `⏳ ${toolConfig[selectedTool].working}`;
  }

  setProgress(0);

  setProgressTitle(
    toolConfig[selectedTool].title
  );

  updateProgressText(
    "Video motoru hazırlanıyor..."
  );
}


function endProcess() {
  processing = false;

  const button =
    document.getElementById(
      "actionButton"
    );

  if (button) {
    button.disabled = false;

    button.textContent =
      `${toolConfig[selectedTool].icon} ` +
      `${toolConfig[selectedTool].name}`;
  }
}


/* =========================================
   MP4
========================================= */

async function convertToMP4() {
  beginProcess();

  const extension =
    getExtension(selectedFile.name) ||
    "video";

  const input =
    uniqueName(
      `input.${extension}`
    );

  const output =
    uniqueName(
      "converted.mp4"
    );

  try {
    await loadFFmpeg();

    updateProgressText(
      "Video MP4 formatına dönüştürülüyor..."
    );

    await ffmpeg.writeFile(
      input,
      await fetchFile(selectedFile)
    );

    await ffmpeg.exec([
      "-i",
      input,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      "23",

      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-movflags",
      "+faststart",

      output
    ]);

    const data =
      await ffmpeg.readFile(output);

    showResult({
      data,

      mime:
        "video/mp4",

      filename:
        createOutputFilename(
          "MP4",
          "mp4"
        ),

      title:
        "✓ MP4 hazır",

      text:
        `Dönüştürme tamamlandı • ` +
        `${bytesToMB(data.byteLength)} MB`,

      button:
        "⬇ MP4'ü İndir"
    });

  } catch (error) {
    processError(
      error,
      "Video MP4 formatına dönüştürülemedi."
    );

  } finally {
    await cleanupFiles(
      input,
      output
    );

    endProcess();
  }
}


/* =========================================
   MP3
========================================= */

async function convertToMP3() {
  beginProcess();

  const extension =
    getExtension(selectedFile.name) ||
    "video";

  const input =
    uniqueName(
      `audio-input.${extension}`
    );

  const output =
    uniqueName(
      "audio.mp3"
    );

  try {
    await loadFFmpeg();

    updateProgressText(
      "Videodaki ses çıkarılıyor..."
    );

    await ffmpeg.writeFile(
      input,
      await fetchFile(selectedFile)
    );

    await ffmpeg.exec([
      "-i",
      input,

      "-vn",

      "-codec:a",
      "libmp3lame",

      "-q:a",
      "2",

      output
    ]);

    const data =
      await ffmpeg.readFile(output);

    showResult({
      data,

      mime:
        "audio/mpeg",

      filename:
        createOutputFilename(
          "Audio",
          "mp3"
        ),

      title:
        "✓ MP3 hazır",

      text:
        `Ses çıkarıldı • ` +
        `${bytesToMB(data.byteLength)} MB`,

      button:
        "⬇ MP3'ü İndir"
    });

  } catch (error) {
    processError(
      error,
      "MP3 dosyası oluşturulamadı."
    );

  } finally {
    await cleanupFiles(
      input,
      output
    );

    endProcess();
  }
}


/* =========================================
   SIKIŞTIRMA
========================================= */

async function compressVideo() {
  beginProcess();

  const level =
    document.getElementById(
      "compressLevel"
    )?.value || "28";

  const extension =
    getExtension(selectedFile.name) ||
    "video";

  const input =
    uniqueName(
      `compress-input.${extension}`
    );

  const output =
    uniqueName(
      "compressed.mp4"
    );

  try {
    await loadFFmpeg();

    updateProgressText(
      "Dosya boyutu küçültülüyor..."
    );

    await ffmpeg.writeFile(
      input,
      await fetchFile(selectedFile)
    );

    await ffmpeg.exec([
      "-i",
      input,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      level,

      "-c:a",
      "aac",

      "-b:a",
      "96k",

      "-movflags",
      "+faststart",

      output
    ]);

    const data =
      await ffmpeg.readFile(output);

    const originalSize =
      selectedFile.size;

    const newSize =
      data.byteLength;

    const reduction =
      Math.round(
        (
          1 -
          newSize / originalSize
        ) * 100
      );

    let resultText;

    if (
      newSize <
      originalSize
    ) {
      resultText =
        `${bytesToMB(originalSize)} MB → ` +
        `${bytesToMB(newSize)} MB • ` +
        `%${Math.max(0, reduction)} daha küçük`;
    } else {
      resultText =
        `${bytesToMB(originalSize)} MB → ` +
        `${bytesToMB(newSize)} MB • ` +
        `Video zaten güçlü biçimde sıkıştırılmış.`;
    }

    showResult({
      data,

      mime:
        "video/mp4",

      filename:
        createOutputFilename(
          "Compressed",
          "mp4"
        ),

      title:
        "✓ Sıkıştırma tamamlandı",

      text:
        resultText,

      button:
        "⬇ Sıkıştırılmış Videoyu İndir"
    });

  } catch (error) {
    processError(
      error,
      "Video sıkıştırılamadı."
    );

  } finally {
    await cleanupFiles(
      input,
      output
    );

    endProcess();
  }
}


/* =========================================
   KIRPMA
========================================= */

async function trimVideo() {
  const start =
    Number(
      document.getElementById(
        "trimStart"
      )?.value
    );

  const end =
    Number(
      document.getElementById(
        "trimEnd"
      )?.value
    );

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end <= start ||
    end > videoDuration + 0.5
  ) {
    alert(
      "Başlangıç ve bitiş sürelerini kontrol et."
    );

    return;
  }

  beginProcess();

  const duration =
    end - start;

  const extension =
    getExtension(selectedFile.name) ||
    "video";

  const input =
    uniqueName(
      `trim-input.${extension}`
    );

  const output =
    uniqueName(
      "trimmed.mp4"
    );

  try {
    await loadFFmpeg();

    updateProgressText(
      `${formatDuration(start)} ile ` +
      `${formatDuration(end)} arası hazırlanıyor...`
    );

    await ffmpeg.writeFile(
      input,
      await fetchFile(selectedFile)
    );

    await ffmpeg.exec([
      "-ss",
      String(start),

      "-i",
      input,

      "-t",
      String(duration),

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      "23",

      "-c:a",
      "aac",

      "-movflags",
      "+faststart",

      output
    ]);

    const data =
      await ffmpeg.readFile(output);

    showResult({
      data,

      mime:
        "video/mp4",

      filename:
        createOutputFilename(
          "Trimmed",
          "mp4"
        ),

      title:
        "✓ Video kırpıldı",

      text:
        `${formatDuration(start)} → ` +
        `${formatDuration(end)} • ` +
        `${bytesToMB(data.byteLength)} MB`,

      button:
        "⬇ Kırpılmış Videoyu İndir"
    });

  } catch (error) {
    processError(
      error,
      "Video kırpılamadı."
    );

  } finally {
    await cleanupFiles(
      input,
      output
    );

    endProcess();
  }
}


/* =========================================
   BOYUTLANDIRMA
========================================= */

async function resizeVideo() {
  const preset =
    document.getElementById(
      "resizePreset"
    )?.value || "vertical";

  const mode =
    document.getElementById(
      "resizeMode"
    )?.value || "fill";


  const presets = {
    vertical: {
      width: 1080,
      height: 1920,
      label: "9:16"
    },

    square: {
      width: 1080,
      height: 1080,
      label: "1:1"
    },

    landscape: {
      width: 1920,
      height: 1080,
      label: "16:9"
    }
  };


  const target =
    presets[preset];

  beginProcess();


  const extension =
    getExtension(selectedFile.name) ||
    "video";

  const input =
    uniqueName(
      `resize-input.${extension}`
    );

  const output =
    uniqueName(
      "resized.mp4"
    );


  try {
    await loadFFmpeg();


    await ffmpeg.writeFile(
      input,
      await fetchFile(selectedFile)
    );


    let filter;


    /* =====================================
       EKRANI DOLDUR
       Siyah boşluk bırakmaz.
       Taşan bölümü kırpar.
    ===================================== */

    if (mode === "fill") {
      updateProgressText(
        `${target.label} ekran tamamen dolduruluyor...`
      );

      filter =
        `scale=${target.width}:${target.height}:` +
        `force_original_aspect_ratio=increase,` +
        `crop=${target.width}:${target.height}:` +
        `(iw-${target.width})/2:` +
        `(ih-${target.height})/2`;
    }


    /* =====================================
       SIĞDIR
       Görüntünün tamamını korur.
       Gerekirse boşluk ekler.
    ===================================== */

    else {
      updateProgressText(
        `${target.label} görüntü alana sığdırılıyor...`
      );

      filter =
        `scale=${target.width}:${target.height}:` +
        `force_original_aspect_ratio=decrease,` +
        `pad=${target.width}:${target.height}:` +
        `(ow-iw)/2:` +
        `(oh-ih)/2:black`;
    }


    await ffmpeg.exec([
      "-i",
      input,

      "-vf",
      filter,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      "23",

      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-movflags",
      "+faststart",

      output
    ]);


    const data =
      await ffmpeg.readFile(output);


    const modeName =
      mode === "fill"
        ? "Ekranı Doldur"
        : "Sığdır";


    showResult({
      data,

      mime:
        "video/mp4",

      filename:
        createOutputFilename(
          target.label.replace(
            ":",
            "x"
          ),
          "mp4"
        ),

      title:
        `✓ ${target.label} video hazır`,

      text:
        `${target.width} × ${target.height}` +
        ` • ${modeName}` +
        ` • ${bytesToMB(data.byteLength)} MB`,

      button:
        "⬇ Boyutlandırılmış Videoyu İndir"
    });


  } catch (error) {
    processError(
      error,
      "Video boyutlandırılamadı."
    );

  } finally {
    await cleanupFiles(
      input,
      output
    );

    endProcess();
  }
}


/* =========================================
   SONUÇ
========================================= */

function showResult({
  data,
  mime,
  filename,
  title,
  text,
  button
}) {
  clearDownloadURL();


  const bytes =
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data);


  downloadURL =
    URL.createObjectURL(
      new Blob(
        [bytes],
        {
          type: mime
        }
      )
    );


  const download =
    document.getElementById(
      "downloadButton"
    );


  if (!download) return;


  download.href =
    downloadURL;

  download.download =
    filename;

  download.textContent =
    button;

  download.classList.add(
    "show"
  );


  setProgress(100);

  setProgressTitle(
    title
  );

  updateProgressText(
    text
  );
}


/* =========================================
   HATA
========================================= */

function processError(
  error,
  message
) {
  console.error(error);

  setProgress(0);

  setProgressTitle(
    "İşlem tamamlanamadı"
  );

  updateProgressText(
    `${message} Lütfen tekrar dene.`
  );
}


/* =========================================
   İLERLEME ÇUBUĞU
========================================= */

function setProgress(percent) {
  const bar =
    document.getElementById(
      "progressBar"
    );

  const label =
    document.getElementById(
      "progressPercent"
    );


  if (bar) {
    bar.style.width =
      `${percent}%`;
  }


  if (label) {
    label.textContent =
      `${percent}%`;
  }
}


function setProgressTitle(text) {
  const element =
    document.getElementById(
      "progressTitle"
    );

  if (element) {
    element.textContent =
      text;
  }
}


function updateProgressText(text) {
  const element =
    document.getElementById(
      "progressText"
    );

  if (element) {
    element.textContent =
      text;
  }
}


/* =========================================
   VIDEO KALDIR
========================================= */

function removeVideo() {
  if (processing) return;

  selectedFile = null;

  videoDuration = 0;
  videoWidth = 0;
  videoHeight = 0;

  videoInput.value = "";


  if (previewURL) {
    URL.revokeObjectURL(
      previewURL
    );

    previewURL = null;
  }


  clearDownloadURL();

  renderEmptyPanel();
}


/* =========================================
   SÜRÜKLE BIRAK
========================================= */

[
  "dragenter",
  "dragover"
].forEach(eventName => {

  dropZone.addEventListener(
    eventName,
    event => {

      event.preventDefault();

      dropZone.classList.add(
        "dragging"
      );

    }
  );

});


[
  "dragleave",
  "drop"
].forEach(eventName => {

  dropZone.addEventListener(
    eventName,
    event => {

      event.preventDefault();

      dropZone.classList.remove(
        "dragging"
      );

    }
  );

});


dropZone.addEventListener(
  "drop",
  event => {

    const file =
      event.dataTransfer.files[0];

    if (file) {
      prepareVideo(file);
    }

  }
);


/* =========================================
   GEÇİCİ DOSYALARI TEMİZLE
========================================= */

async function cleanupFiles(
  ...files
) {
  for (const file of files) {
    if (!file) continue;

    try {
      await ffmpeg.deleteFile(
        file
      );
    } catch {
      // Dosya zaten yoksa sorun değil.
    }
  }
}


function clearDownloadURL() {
  if (downloadURL) {

    URL.revokeObjectURL(
      downloadURL
    );

    downloadURL = null;
  }
}


/* =========================================
   DOSYA UZANTISI
========================================= */

function getExtension(
  filename
) {
  const parts =
    filename.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts
    .pop()
    .toLowerCase();
}


/* =========================================
   MB
========================================= */

function bytesToMB(bytes) {
  return (
    bytes /
    (1024 * 1024)
  ).toFixed(2);
}


/* =========================================
   SÜRE
========================================= */

function formatDuration(
  seconds
) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "00:00";
  }


  const total =
    Math.floor(seconds);


  const hours =
    Math.floor(
      total / 3600
    );


  const minutes =
    Math.floor(
      (total % 3600) /
      60
    );


  const secs =
    total % 60;


  if (hours > 0) {
    return [
      hours,

      minutes
        .toString()
        .padStart(
          2,
          "0"
        ),

      secs
        .toString()
        .padStart(
          2,
          "0"
        )

    ].join(":");
  }


  return [
    minutes
      .toString()
      .padStart(
        2,
        "0"
      ),

    secs
      .toString()
      .padStart(
        2,
        "0"
      )

  ].join(":");
}


/* =========================================
   ÇIKTI DOSYA ADI
========================================= */

function createOutputFilename(
  suffix,
  extension
) {
  const original =
    selectedFile.name
      .replace(
        /\.[^/.]+$/,
        ""
      )
      .replace(
        /[<>:"/\\|?*]+/g,
        "-"
      );


  return (
    `${original}-${suffix}.${extension}`
  );
}


/* =========================================
   GEÇİCİ DOSYA ADI
========================================= */

function uniqueName(
  filename
) {
  return (
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .slice(2, 8)}-` +
    filename
  );
}


/* =========================================
   HTML GÜVENLİĞİ
========================================= */

function escapeHTML(
  value
) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================================
   SAYFA KAPANIRKEN TEMİZLE
========================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (previewURL) {
      URL.revokeObjectURL(
        previewURL
      );
    }

    clearDownloadURL();

  }
);