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
  
  // 开发者工具（用于调试）
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

// 移动图片（支持跨驱动器移动）
ipcMain.handle('file:moveImages', async (event, { sourcePaths, targetFolder }) => {
  try {
    const results = [];
    
    // 确保目标文件夹存在
    if (!fsSync.existsSync(targetFolder)) {
      await fs.mkdir(targetFolder, { recursive: true });
    }
    
    for (const sourcePath of sourcePaths) {
      try {
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
        
        // 尝试直接重命名（同一驱动器）
        try {
          await fs.rename(sourcePath, finalTargetPath);
        } catch (renameError) {
          // 如果 rename 失败（跨驱动器），则使用复制+删除的方式
          if (renameError.code === 'EXDEV') {
            // 先复制文件
            await fs.copyFile(sourcePath, finalTargetPath);
            // 复制成功后删除源文件
            await fs.unlink(sourcePath);
          } else {
            throw renameError;
          }
        }
        
        results.push({
          success: true,
          source: sourcePath,
          target: finalTargetPath
        });
      } catch (fileError) {
        // 记录单个文件的错误，但继续处理其他文件
        results.push({
          success: false,
          source: sourcePath,
          error: fileError.message
        });
      }
    }
    
    // 检查是否有失败的文件
    const failedFiles = results.filter(r => !r.success);
    if (failedFiles.length > 0) {
      return { 
        success: false, 
        results,
        error: `${failedFiles.length} 个文件移动失败` 
      };
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
      try {
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
      } catch (fileError) {
        // 记录单个文件的错误，但继续处理其他文件
        results.push({
          success: false,
          source: sourcePath,
          error: fileError.message
        });
      }
    }
    
    // 检查是否有失败的文件
    const failedFiles = results.filter(r => !r.success);
    if (failedFiles.length > 0) {
      return { 
        success: false, 
        results,
        error: `${failedFiles.length} 个文件复制失败` 
      };
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

// 获取图片信息
ipcMain.handle('file:getImageInfo', async (event, imagePath) => {
  try {
    const stats = await fs.stat(imagePath);
    const fileName = path.basename(imagePath);
    
    return {
      path: imagePath,
      name: fileName,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      modifiedTime: stats.mtime
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    throw error;
  }
});

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

