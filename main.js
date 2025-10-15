const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // 开发时可以打开开发者工具
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 选择文件夹对话框
ipcMain.handle('dialog:selectFolder', async (event, title) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: title || '选择文件夹'
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// 获取文件夹中的所有图片
ipcMain.handle('folder:getImages', async (event, folderPath) => {
  try {
    const files = await fs.readdir(folderPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });
    
    // 返回完整路径
    const imagePaths = imageFiles.map(file => path.join(folderPath, file));
    
    return imagePaths;
  } catch (error) {
    console.error('Error reading folder:', error);
    throw error;
  }
});

// 移动图片
ipcMain.handle('file:moveImages', async (event, { sourcePaths, targetFolder }) => {
  try {
    const results = [];
    
    // 确保目标文件夹存在
    if (!fsSync.existsSync(targetFolder)) {
      await fs.mkdir(targetFolder, { recursive: true });
    }
    
    for (const sourcePath of sourcePaths) {
      const fileName = path.basename(sourcePath);
      const targetPath = path.join(targetFolder, fileName);
      
      // 检查目标文件是否已存在
      let finalTargetPath = targetPath;
      let counter = 1;
      while (fsSync.existsSync(finalTargetPath)) {
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        finalTargetPath = path.join(targetFolder, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }
      
      await fs.rename(sourcePath, finalTargetPath);
      results.push({
        success: true,
        source: sourcePath,
        target: finalTargetPath
      });
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Error moving images:', error);
    return { success: false, error: error.message };
  }
});

// 复制图片
ipcMain.handle('file:copyImages', async (event, { sourcePaths, targetFolder }) => {
  try {
    const results = [];
    
    // 确保目标文件夹存在
    if (!fsSync.existsSync(targetFolder)) {
      await fs.mkdir(targetFolder, { recursive: true });
    }
    
    for (const sourcePath of sourcePaths) {
      const fileName = path.basename(sourcePath);
      const targetPath = path.join(targetFolder, fileName);
      
      // 检查目标文件是否已存在
      let finalTargetPath = targetPath;
      let counter = 1;
      while (fsSync.existsSync(finalTargetPath)) {
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        finalTargetPath = path.join(targetFolder, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }
      
      await fs.copyFile(sourcePath, finalTargetPath);
      results.push({
        success: true,
        source: sourcePath,
        target: finalTargetPath
      });
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Error copying images:', error);
    return { success: false, error: error.message };
  }
});

// 显示消息对话框
ipcMain.handle('dialog:showMessage', async (event, { type, title, message }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: type || 'info',
    title: title || '消息',
    message: message
  });
  return result;
});

