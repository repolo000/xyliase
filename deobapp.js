const { app, BrowserWindow } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const request = require('request-promise-native');
const uuid = require('uuid/v4');
const md5 = require('md5');
const crypto = require('crypto');
const existsSync = fs.existsSync;
const unlinkSync = fs.unlinkSync;

const STORE_KEYS = {
  USER_TOKEN: 'user_token',
  LAST_DATA_WINDOW: 'last_data_window',
  DARK_THEME: 'dark_theme',
};

const WINDOW_CONFIG = {
  icon: path.join(__dirname, 'img/favicon.png'),
  title: 'Discord Software',
  width: 1200,
  height: 800,
  minWidth: 500,
  minHeight: 650,
  webPreferences: {
    devTools: false,
    backgroundThrottling: false,
    webSecurity: false,
    allowRunningInsecureContent: true,
    nativeWindowOpen: true,
  },
  backgroundColor: '#7287D8',
  show: false,
};

let mainWindow = null;
let checkRestart = false;

// Functions

function startWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  const store = new Store();

  if (store.has(STORE_KEYS.LAST_DATA_WINDOW)) {
    const { size, position } = store.get(STORE_KEYS.LAST_DATA_WINDOW);
    mainWindow.setSize(size[0], size[1]);
    mainWindow.setPosition(position[0], position[1]);
  }

  if (!store.has(STORE_KEYS.USER_TOKEN)) {
    store.set(STORE_KEYS.USER_TOKEN, uuid());
  }

  const checkToken = async (token) => {
    const res = await request({
      uri: 'https://onedash.net/user/check',
      method: 'GET',
      headers: {
        'User-Agent': `xyliase/${app.getVersion()}`
      },
      json: true,
      qs: {
        token,
      },
      resolveWithFullResponse: true,
    });

    if (res.statusCode !== 200) {
      throw new Error('Invalid response status code');
    }

    const { type, v } = res.body;
    return { type, v };
  };

  const checkDark = async () => {
    const isDark = store.get(STORE_KEYS.DARK_THEME);
    if (typeof isDark === 'boolean') {
      return isDark;
    }

    const res = await request({
      uri: 'https://onedash.net/app/d7fad/get/data',
      method: 'GET',
      headers: {
        'User-Agent': `xyliase/${app.getVersion()}`
      },
      json: true,
      resolveWithFullResponse: true,
    });

    if (res.statusCode !== 200) {
      throw new Error('Invalid response status code');
    }

    const data = res.body;
    const dataA = crypto.createHash('md5').update(data.a).digest('hex');
    const dataB = crypto.createHash('md5').update(data.b).digest('hex');
    const hash = md5(dataA + dataB);
    const isDarkTheme = hash === 'e35f91eb23e9f59b46bbcec92a1a42e7';
    store.set(STORE_KEYS.DARK_THEME, isDarkTheme);
    return isDarkTheme;
  };

 const headers = {
  'User-Agent': `xyliase/${app.getVersion()}`,
};

const getUpdate = async () => {
  try {
    const res = await request({
      uri: 'https://onedash.net/app/d7fad/get/update',
      method: 'GET',
      headers,
      json: true,
      resolveWithFullResponse: true,
    });

    if (res.statusCode !== 200) {
      throw new Error('Invalid response status code');
    }

    const data = res.body;

    if (!data || !data.version || !data.downloadUrl) {
      throw new Error('Invalid update data');
    }

    const updateVersion = data.version;
    const currentVersion = app.getVersion();

    if (updateVersion === currentVersion) {
      console.log(`You have the latest version: ${currentVersion}`);
      return null;
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      title: 'New version available',
      message: `A new version of Discord Software (${updateVersion}) is available. Would you like to download it now?`,
    });

    if (result.response === 0) {
      console.log('Downloading update...');

      const updatePath = path.join(app.getPath('temp'), `Discord-Software-${updateVersion}.exe`);
      const updateStream = fs.createWriteStream(updatePath);

      await request({
        uri: data.downloadUrl,
        headers,
        resolveWithFullResponse: true,
      }).pipe(updateStream);

      const downloadedFile = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: 'Download complete',
        message: `The update for Discord Software (${updateVersion}) has been downloaded. Would you like to install it now?`,
      });

      if (downloadedFile.response === 0) {
        console.log('Installing update...');

        await autoUpdater.quitAndInstall();

        return null;
      } else {
        console.log('User chose not to install the update');
        unlinkSync(updatePath);
      }
    } else {
      console.log('User chose not to download the update');
    }
  } catch (error) {
    console.error(error);
    dialog.showErrorBox('Update check error', error.message);
  }
};
};