const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择文件夹
  selectFolder: (title) => ipcRenderer.invoke('dialog:selectFolder', title),
  
  // 获取文件夹中的图片
  getImages: (folderPath) => ipcRenderer.invoke('folder:getImages', folderPath),
  
  // 移动图片
  moveImages: (sourcePaths, targetFolder) => 
    ipcRenderer.invoke('file:moveImages', { sourcePaths, targetFolder }),
  
  // 复制图片
  copyImages: (sourcePaths, targetFolder) => 
    ipcRenderer.invoke('file:copyImages', { sourcePaths, targetFolder }),
  
  // 显示消息对话框
  showMessage: (type, title, message) => 
    ipcRenderer.invoke('dialog:showMessage', { type, title, message })
});

