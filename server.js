const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");

const app = express();
const PORT = process.env.PORT || 3000;
const FFMPEG_PATH = require("ffmpeg-static") || "ffmpeg";
const YTDLP_PATH = path.join(__dirname, "yt-dlp.exe");
/* =========================================================
   TEMEL AYARLAR
========================================================= */

app.use(cors());

/* =========================================================
   TARAYICI FFMPEG DOSYALARI
========================================================= */

app.use(
  "/vendor/ffmpeg",
  express.static(
    path.join(
      __dirname,
      "node_modules",
      "@ffmpeg",
      "ffmpeg",
      "dist",
      "esm"
    )
  )
);

app.use(
  "/vendor/ffmpeg-util",
  express.static(
    path.join(
      __dirname,
      "node_modules",
      "@ffmpeg",
      "util",
      "dist",
      "esm"
    )
  )
);
app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

/* =========================================================
   GEÇİCİ DOSYA KLASÖRÜ
========================================================= */

const TEMP_DIR = path.join(
  os.tmpdir(),
  "bividoo"
);

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, {
    recursive: true,
  });
}

/* =========================================================
   YÜKLEME AYARLARI
========================================================= */

const storage = multer.diskStorage({
  destination: function (
    req,
    file,
    cb
  ) {
    cb(null, TEMP_DIR);
  },

  filename: function (
    req,
    file,
    cb
  ) {
    const extension =
      path.extname(file.originalname) ||
      ".video";

    cb(
      null,
      crypto.randomUUID() + extension
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 500 * 1024 * 1024,
  },

  fileFilter: function (
    req,
    file,
    cb
  ) {
    if (
      file.mimetype &&
      (
        file.mimetype.startsWith("video/") ||
        file.mimetype ===
          "application/octet-stream"
      )
    ) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Lütfen geçerli bir video dosyası seç."
      )
    );
  },
});

/* =========================================================
   DOSYA SİL
========================================================= */

function safeDelete(filePath) {
  if (!filePath) {
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(
      "Dosya silinemedi:",
      error.message
    );
  }
}

/* =========================================================
   FFMPEG
========================================================= */

function runFFmpeg(args) {
  return new Promise(
    (resolve, reject) => {
      const ffmpeg = spawn(
FFMPEG_PATH,
        args,
        {
          windowsHide: true,
        }
      );

      let errorOutput = "";

      ffmpeg.stderr.on(
        "data",
        (data) => {
          errorOutput +=
            data.toString();
        }
      );

      ffmpeg.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      ffmpeg.on(
        "close",
        (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          console.error(
            "FFmpeg:",
            errorOutput
          );

          reject(
            new Error(
              "FFmpeg işlemi başarısız oldu."
            )
          );
        }
      );
    }
  );
}

/* =========================================================
   KALİTE FİLTRESİ
========================================================= */

function getScaleFilter(quality) {
  if (quality === "1080") {
    return (
      "scale=-2:" +
      "'min(1080,ih)'"
    );
  }

  if (quality === "720") {
    return (
      "scale=-2:" +
      "'min(720,ih)'"
    );
  }

  if (quality === "480") {
    return (
      "scale=-2:" +
      "'min(480,ih)'"
    );
  }

  return null;
}

/* =========================================================
   DOSYA İŞLEME AYARLARI
========================================================= */

async function processVideo(
  inputPath,
  outputPath,
  type,
  quality,
  audioBitrate
) {
  const args = [
    "-y",
    "-i",
    inputPath,
  ];

  const scaleFilter =
    getScaleFilter(quality);

  if (type === "mp3") {
    args.push(
      "-vn",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      `${audioBitrate}k`,
      outputPath
    );

    await runFFmpeg(args);
    return;
  }

  if (scaleFilter) {
    args.push(
      "-vf",
      scaleFilter
    );
  }

  if (type === "mute") {
    args.push(
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    );

    await runFFmpeg(args);
    return;
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath
  );

  await runFFmpeg(args);
}

/* =========================================================
   ÇIKTI AYARLARI
========================================================= */

function normalizeSettings(body) {
  const allowedTypes = [
    "mp4",
    "mp3",
    "mute",
  ];

  const allowedQualities = [
    "original",
    "1080",
    "720",
    "480",
  ];

  const allowedAudioBitrates = [
    "320",
    "192",
    "128",
  ];

  const type =
    allowedTypes.includes(body.type)
      ? body.type
      : "mp4";

  const quality =
    allowedQualities.includes(
      body.quality
    )
      ? body.quality
      : "original";

  const audioBitrate =
    allowedAudioBitrates.includes(
      body.audioBitrate
    )
      ? body.audioBitrate
      : "192";

  return {
    type,
    quality,
    audioBitrate,
  };
}

/* =========================================================
   DOSYA ADI
========================================================= */

function createOutput(type) {
  const extension =
    type === "mp3"
      ? ".mp3"
      : ".mp4";

  const fileName =
    "bividoo-" +
    crypto.randomUUID() +
    extension;

  return {
    extension,

    fileName,

    outputPath:
      path.join(
        TEMP_DIR,
        fileName
      ),
  };
}

/* =========================================================
   ANA SAYFA
========================================================= */

app.get(
  "/api",
  (req, res) => {
    res.json({
      success: true,
      service: "BiVidoo API",
      message:
        "BiVidoo sunucusu çalışıyor.",
    });
  }
);

/* =========================================================
   STATUS
========================================================= */

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      success: true,
      service: "BiVidoo API",
      status: "online",
    });
  }
);

/* =========================================================
   FFMPEG STATUS
========================================================= */

app.get(
  "/api/ffmpeg-status",
  (req, res) => {
    const ffmpeg = spawn(
FFMPEG_PATH,
      ["-version"],
      {
        windowsHide: true,
      }
    );

    let output = "";

    ffmpeg.stdout.on(
      "data",
      (data) => {
        output +=
          data.toString();
      }
    );

    ffmpeg.on(
      "error",
      (error) => {
        res.status(500).json({
          success: false,
          status: "offline",
          message:
            error.message,
        });
      }
    );

    ffmpeg.on(
      "close",
      (code) => {
        if (
          res.headersSent
        ) {
          return;
        }

        if (code !== 0) {
          res.status(500).json({
            success: false,
            status: "offline",
          });

          return;
        }

        const firstLine =
          output
            .split("\n")[0]
            .trim();

        res.json({
          success: true,
          status: "online",
          ffmpeg: firstLine,
        });
      }
    );
  }
);

/* =========================================================
   URL GÜVENLİK
========================================================= */

function isPrivateIP(ip) {
  if (!ip) {
    return true;
  }

  if (
    ip === "::1" ||
    ip === "0.0.0.0"
  ) {
    return true;
  }

  if (
    ip.startsWith("127.")
  ) {
    return true;
  }

  if (
    ip.startsWith("10.")
  ) {
    return true;
  }

  if (
    ip.startsWith("192.168.")
  ) {
    return true;
  }

  if (
    ip.startsWith("169.254.")
  ) {
    return true;
  }

  const parts =
    ip.split(".")
      .map(Number);

  if (
    parts.length === 4 &&
    parts[0] === 172 &&
    parts[1] >= 16 &&
    parts[1] <= 31
  ) {
    return true;
  }

  const lower =
    ip.toLowerCase();

  if (
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:")
  ) {
    return true;
  }

  return false;
}

async function validateRemoteURL(
  value
) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Geçerli bir URL gir."
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Yalnızca HTTP veya HTTPS bağlantıları kullanılabilir."
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  const blockedPlatforms = [
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
];

  const blocked =
    blockedPlatforms.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(
          "." + domain
        )
    );

  if (blocked) {
    throw new Error(
      "Bu bağlantı bir platform sayfası. Doğrudan video dosyası bağlantısı gerekiyor."
    );
  }

  if (
    hostname === "localhost"
  ) {
    throw new Error(
      "Yerel ağ adresleri kullanılamaz."
    );
  }

  if (
    net.isIP(hostname)
  ) {
    if (isPrivateIP(hostname)) {
      throw new Error(
        "Özel ağ adresleri kullanılamaz."
      );
    }
  } else {
    const addresses =
      await dns.lookup(
        hostname,
        {
          all: true,
        }
      );

    if (
      !addresses.length
    ) {
      throw new Error(
        "Sunucu adresi bulunamadı."
      );
    }

    for (
      const address of addresses
    ) {
      if (
        isPrivateIP(
          address.address
        )
      ) {
        throw new Error(
          "Özel ağ adresleri kullanılamaz."
        );
      }
    }
  }

  return url;
}

/* =========================================================
   UZAK DOSYAYI İNDİR
========================================================= */

async function downloadRemoteVideo(
  url,
  destination
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      60000
    );

  let response;

  try {
    response =
      await fetch(
        url.toString(),
        {
          redirect: "manual",
          signal:
            controller.signal,
          headers: {
            "User-Agent":
              "BiVidoo/1.0",
          },
        }
      );

    let redirects = 0;

    while (
      response.status >= 300 &&
      response.status < 400
    ) {
      if (
        redirects >= 5
      ) {
        throw new Error(
          "Çok fazla yönlendirme var."
        );
      }

      const location =
        response.headers.get(
          "location"
        );

      if (!location) {
        throw new Error(
          "Geçersiz yönlendirme."
        );
      }

      const nextURL =
        new URL(
          location,
          url
        );

      await validateRemoteURL(
        nextURL.toString()
      );

      url = nextURL;

      response =
        await fetch(
          url.toString(),
          {
            redirect: "manual",
            signal:
              controller.signal,
            headers: {
              "User-Agent":
                "BiVidoo/1.0",
            },
          }
        );

      redirects++;
    }

    if (!response.ok) {
      throw new Error(
        "Video kaynağına ulaşılamadı."
      );
    }

    const contentType =
      (
        response.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();

    if (
      !contentType.startsWith(
        "video/"
      ) &&
      contentType !==
        "application/octet-stream"
    ) {
      throw new Error(
        "Bağlantı doğrudan bir video dosyası değil."
      );
    }

    const contentLength =
      Number(
        response.headers.get(
          "content-length"
        ) || 0
      );

    const maxSize =
      500 * 1024 * 1024;

    if (
      contentLength &&
      contentLength > maxSize
    ) {
      throw new Error(
        "Video 500 MB sınırını aşıyor."
      );
    }

    if (!response.body) {
      throw new Error(
        "Video verisi alınamadı."
      );
    }

    const fileStream =
      fs.createWriteStream(
        destination
      );

    const reader =
      response.body.getReader();

    let downloaded = 0;

    while (true) {
      const {
        done,
        value,
      } =
        await reader.read();

      if (done) {
        break;
      }

      downloaded +=
        value.length;

      if (
        downloaded > maxSize
      ) {
        try {
          await reader.cancel();
        } catch {}

        fileStream.destroy();

        throw new Error(
          "Video 500 MB sınırını aşıyor."
        );
      }

      if (
        !fileStream.write(
          Buffer.from(value)
        )
      ) {
        await new Promise(
          (resolve) =>
            fileStream.once(
              "drain",
              resolve
            )
        );
      }
    }

    await new Promise(
      (resolve, reject) => {
        fileStream.end(resolve);

        fileStream.on(
          "error",
          reject
        );
      }
    );
  } catch (error) {
    safeDelete(destination);

    if (
      error.name ===
      "AbortError"
    ) {
      throw new Error(
        "Video indirme zaman aşımına uğradı."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   VIDEO KONTROL
========================================================= */

app.get(
  "/api/video/check",
  async (req, res) => {
    const url =
      String(
        req.query.url || ""
      ).trim();

    if (!url) {
      res.status(400).json({
        success: false,
        message:
          "Video bağlantısı gerekli.",
      });

      return;
    }

    try {
      const parsed =
        await validateRemoteURL(
          url
        );

      res.json({
        success: true,
        url:
          parsed.toString(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

/* =========================================================
   DOĞRUDAN VIDEO İNDİR
========================================================= */
/* =========================================================
   YOUTUBE VIDEO İNDİR
========================================================= */

app.get(
  "/api/download/youtube",
  async (req, res) => {
    const url =
      String(
        req.query.url || ""
      ).trim();

    if (!url) {
      res.status(400).json({
        success: false,
        message:
          "YouTube bağlantısı gerekli.",
      });

      return;
    }

    let outputPath = null;

    try {
      const parsedURL =
        new URL(url);

      const hostname =
        parsedURL.hostname
          .toLowerCase()
          .replace(/^www\./, "");

      if (
        hostname !== "youtube.com" &&
        hostname !== "m.youtube.com" &&
        hostname !== "youtu.be"
      ) {
        throw new Error(
          "Sadece YouTube bağlantıları destekleniyor."
        );
      }

      outputPath =
        path.join(
          TEMP_DIR,
          crypto.randomUUID() +
            ".mp4"
        );

      const args = [
  "--js-runtimes",
  "deno",
  "--ffmpeg-location",
  path.dirname(FFMPEG_PATH),
  "-f",
  "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
  "--merge-output-format",
  "mp4",
  "--no-playlist",
  "-o",
  outputPath,
  url,
];

      await new Promise(
        (resolve, reject) => {
          const process =
            spawn(
              YTDLP_PATH,
              args,
              {
                windowsHide: true,
              }
            );

          let errorOutput = "";

          process.stderr.on(
            "data",
            (data) => {
              errorOutput +=
                data.toString();
            }
          );

          process.on(
            "error",
            (error) => {
              reject(error);
            }
          );

          process.on(
            "close",
            (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(
                  new Error(
                    errorOutput ||
                      "YouTube videosu indirilemedi."
                  )
                );
              }
            }
          );
        }
      );

      if (
        !fs.existsSync(
          outputPath
        )
      ) {
        throw new Error(
          "İndirilen video dosyası bulunamadı."
        );
      }

      res.download(
        outputPath,
        "bividoo-youtube.mp4",
        () => {
          safeDelete(
            outputPath
          );
        }
      );

    } catch (error) {

      safeDelete(
        outputPath
      );

      console.error(
        "YouTube download:",
        error.message
      );

      if (
        !res.headersSent
      ) {
        res.status(400).json({
          success: false,
          message:
            error.message ||
            "YouTube videosu indirilemedi.",
        });
      }
    }
  }
);
app.get(
  "/api/download/direct",
  async (req, res) => {
    const url =
      String(
        req.query.url || ""
      ).trim();

    if (!url) {
      res.status(400).json({
        success: false,
        message:
          "Video bağlantısı gerekli.",
      });

      return;
    }

    let inputPath = null;

    try {
      const parsed =
        await validateRemoteURL(
          url
        );

      inputPath =
        path.join(
          TEMP_DIR,
          crypto.randomUUID() +
            ".video"
        );

      await downloadRemoteVideo(
        parsed,
        inputPath
      );

      res.download(
        inputPath,
        "bividoo-video.mp4",
        () => {
          safeDelete(
            inputPath
          );
        }
      );
    } catch (error) {
      safeDelete(
        inputPath
      );

      console.error(
        "Direct download:",
        error.message
      );

      if (
        !res.headersSent
      ) {
        res.status(400).json({
          success: false,
          message:
            error.message,
        });
      }
    }
  }
);

/* =========================================================
   BİLGİSAYARDAN YÜKLENEN VİDEOYU İŞLE
========================================================= */

app.post(
  "/api/process",
  upload.single("video"),
  async (req, res) => {
    let inputPath = null;
    let outputPath = null;

    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message:
            "Video dosyası bulunamadı.",
        });

        return;
      }

      inputPath =
        req.file.path;

      const settings =
        normalizeSettings(
          req.body
        );

      const output =
        createOutput(
          settings.type
        );

      outputPath =
        output.outputPath;

      await processVideo(
        inputPath,
        outputPath,
        settings.type,
        settings.quality,
        settings.audioBitrate
      );

      safeDelete(
        inputPath
      );

      inputPath = null;

      const downloadName =
        settings.type === "mp3"
          ? "bividoo-audio.mp3"
          : settings.type ===
              "mute"
            ? "bividoo-sessiz.mp4"
            : "bividoo-video.mp4";

      res.download(
        outputPath,
        downloadName,
        () => {
          safeDelete(
            outputPath
          );
        }
      );
    } catch (error) {
      safeDelete(
        inputPath
      );

      safeDelete(
        outputPath
      );

      console.error(
        "Process:",
        error.message
      );

      if (
        !res.headersSent
      ) {
        res.status(500).json({
          success: false,
          message:
            error.message,
        });
      }
    }
  }
);
/* =========================================================
   YOUTUBE MP3 İNDİR
========================================================= */

app.get(
  "/api/download/youtube-mp3",
  async (req, res) => {
    const url =
      String(
        req.query.url || ""
      ).trim();

    if (!url) {
      res.status(400).json({
        success: false,
        message: "YouTube bağlantısı gerekli.",
      });

      return;
    }

    let outputPath = null;

    try {
      const parsedURL = new URL(url);

      const hostname =
        parsedURL.hostname
          .toLowerCase()
          .replace(/^www\./, "");

      if (
        hostname !== "youtube.com" &&
        hostname !== "m.youtube.com" &&
        hostname !== "youtu.be"
      ) {
        throw new Error(
          "Sadece YouTube bağlantıları destekleniyor."
        );
      }

      outputPath =
        path.join(
          TEMP_DIR,
          crypto.randomUUID() + ".mp3"
        );

      const args = [
        "--js-runtimes",
        "deno",

        "--ffmpeg-location",
        path.dirname(FFMPEG_PATH),

        "-x",

        "--audio-format",
        "mp3",

        "--audio-quality",
        "192K",

        "--no-playlist",

        "-o",
        outputPath,

        url,
      ];

      await new Promise(
        (resolve, reject) => {
          const process =
            spawn(
              YTDLP_PATH,
              args,
              {
                windowsHide: true,
              }
            );

          let errorOutput = "";

          process.stderr.on(
            "data",
            (data) => {
              errorOutput +=
                data.toString();
            }
          );

          process.on(
            "error",
            reject
          );

          process.on(
            "close",
            (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(
                  new Error(
                    errorOutput ||
                      "YouTube MP3 dönüştürme başarısız."
                  )
                );
              }
            }
          );
        }
      );

      if (!fs.existsSync(outputPath)) {
        throw new Error(
          "MP3 dosyası oluşturulamadı."
        );
      }

      res.download(
        outputPath,
        "bividoo-audio.mp3",
        () => {
          safeDelete(
            outputPath
          );
        }
      );

    } catch (error) {

      safeDelete(
        outputPath
      );

      console.error(
        "YouTube MP3:",
        error.message
      );

      if (
        !res.headersSent
      ) {
        res.status(500).json({
          success: false,
          message:
            error.message,
        });
      }
    }
  }
);

/* =========================================================
   URL'DEN VIDEO İŞLE
========================================================= */

app.post(
  "/api/process-url",
  async (req, res) => {
    let inputPath = null;
    let outputPath = null;

    try {
      const remoteURL =
        String(
          req.body.url || ""
        ).trim();

      if (!remoteURL) {
        res.status(400).json({
          success: false,
          message:
            "Video bağlantısı gerekli.",
        });

        return;
      }

      const parsed =
        await validateRemoteURL(
          remoteURL
        );

      const settings =
        normalizeSettings(
          req.body
        );

      inputPath =
        path.join(
          TEMP_DIR,
          crypto.randomUUID() +
            ".video"
        );

      await downloadRemoteVideo(
        parsed,
        inputPath
      );

      const output =
        createOutput(
          settings.type
        );

      outputPath =
        output.outputPath;

      await processVideo(
        inputPath,
        outputPath,
        settings.type,
        settings.quality,
        settings.audioBitrate
      );

      safeDelete(
        inputPath
      );

      inputPath = null;

      const downloadName =
        settings.type === "mp3"
          ? "bividoo-audio.mp3"
          : settings.type ===
              "mute"
            ? "bividoo-sessiz.mp4"
            : "bividoo-video.mp4";

      res.download(
        outputPath,
        downloadName,
        () => {
          safeDelete(
            outputPath
          );
        }
      );
    } catch (error) {
      safeDelete(
        inputPath
      );

      safeDelete(
        outputPath
      );

      console.error(
        "Process URL:",
        error.message
      );

      if (
        !res.headersSent
      ) {
        res.status(400).json({
          success: false,
          message:
            error.message,
        });
      }
    }
  }
);

/* =========================================================
   MULTER / GENEL HATA
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
        multer.MulterError &&
      error.code ===
        "LIMIT_FILE_SIZE"
    ) {
      res.status(413).json({
        success: false,
        message:
          "Video en fazla 500 MB olabilir.",
      });

      return;
    }

    if (error) {
      console.error(
        "Server:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Sunucu hatası oluştu.",
      });

      return;
    }

    next();
  }
);

/* =========================================================
   SUNUCU
========================================================= */

app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.listen(
    PORT,
  () => {
    console.log(
      "🚀 BiVidoo Server çalışıyor"
    );

    console.log(
      `📡 Port: ${PORT}`
    );

    console.log(
      "🎬 FFmpeg bağlantısı hazır"
    );

    console.log(
      "🎵 MP3 dönüştürme hazır"
    );

    console.log(
      "🔇 Sessiz video hazır"
    );

    console.log(
      "📺 1080p / 720p / 480p hazır"
    );

    console.log(
      "🔗 Doğrudan URL işleme hazır"
    );
  }
);