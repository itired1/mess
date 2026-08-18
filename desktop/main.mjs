import { app, BrowserWindow, shell } from "electron";
import path from "path";
import fs from "fs";
import net from "net";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

function freePort(from) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", () => freePort(from + 1).then(resolve, reject));
    srv.listen(from, "127.0.0.1", () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const dataDir = path.join(app.getPath("userData"), "lilbrumessage");
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DB_PATH = path.join(dataDir, "db.json");
  process.env.DATA_ROOT = dataDir;
  process.env.UPLOADS_DIR = path.join(dataDir, "uploads");
  process.env.CLIENT_DIST = path.join(here, "app", "client", "dist");

  const port = Number(process.env.LILBRU_PORT || (await freePort(4210)));
  process.env.PORT = String(port);

  await import(pathToFileURL(path.join(here, "app", "server", "index.js")).href);

  let win = null;
  const createWindow = () => {
    win = new BrowserWindow({
      width: 1160,
      height: 760,
      minWidth: 940,
      minHeight: 600,
      title: "lilbrumessage",
      autoHideMenuBar: true,
      backgroundColor: "#121218",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.loadURL(`http://127.0.0.1:${port}`);
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
  };

  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}
