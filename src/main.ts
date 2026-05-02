import plugin from '../plugin.json';

interface AcodeAlert {
  (title: string, message: string): void;
}

interface AcodeConfirm {
  (title: string, message: string): Promise<boolean>;
}

interface AcodeSelect {
  (title: string, options: string[]): Promise<string | null>;
}

interface Terminal {
  id: string;
}

interface TerminalModule {
  create(options: { name: string }): Promise<Terminal>;
  write(id: string, content: string): Promise<void>;
}

interface AcodeCommand {
  name: string;
  description: string;
  exec: () => void | Promise<void>;
}

interface EditorManager {
  isCodeMirror: boolean;
  activeFile?: { path?: string; filename?: string } | null;
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  editor: EditorCommands;
  getActiveFile?: () => { path?: string; filename?: string } | null;
}

interface EditorCommands {
  commands: {
    addCommand: (cmd: AcodeCommand) => void;
    removeCommand: (name: string) => void;
  };
  activeFile?: { path?: string; filename?: string } | null;
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
}

interface AcodeModule {
  require: (module: string) => unknown;
  setPluginInit: (id: string, initFn: (baseUrl: string, $page: unknown, ctx: { cacheFileUrl: string; cacheFile: unknown }) => Promise<void>) => void;
  setPluginUnmount: (id: string, unmountFn: () => void) => void;
}

let acode: AcodeModule;
let editorManager: EditorManager;
let alert: AcodeAlert;
let confirm: AcodeConfirm;
let select: AcodeSelect;
let terminal: TerminalModule;

class OpenCodeAlpinePlugin {
  baseUrl = '';
  private runBtn: HTMLSpanElement | null = null;

  async init(): Promise<void> {
    const win = window as Window & { acode?: AcodeModule; editorManager?: EditorManager };
    acode = win.acode as AcodeModule;
    editorManager = win.editorManager as EditorManager;
    
    alert = acode.require('alert') as AcodeAlert;
    confirm = acode.require('confirm') as AcodeConfirm;
    select = acode.require('select') as AcodeSelect;
    terminal = acode.require('terminal') as TerminalModule;

    this.registerCommands();
    this.setupRunButton();
  }

  private getActiveFile(): { path?: string; filename?: string } | null {
    try {
      if (!editorManager) return null;
      
      if (editorManager.isCodeMirror) {
        return editorManager.activeFile || null;
      } else {
        return editorManager.editor?.activeFile || null;
      }
    } catch {
      return null;
    }
  }

  private getDirectory(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  private getHeader(): HTMLElement | null {
    return document.querySelector('header');
  }

  private createRunButton(): HTMLSpanElement {
    const btn = document.createElement('span');
    btn.className = 'icon opencode-btn';
    btn.setAttribute('action', 'opencode');
    btn.title = 'Run with OpenCode';
    btn.style.cssText = `
      width: 24px !important;
      height: 24px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background-image: url(${this.baseUrl}icon.png) !important;
      background-size: cover !important;
      background-position: center !important;
      border-radius: 4px !important;
      cursor: pointer !important;
    `;
    btn.onclick = async () => {
      const file = this.getActiveFile();
      if (!file?.path) return;
      
      const dir = this.getDirectory(file.path);
      const term = await terminal.create({ name: 'OpenCode' });
      await terminal.write(term.id, "cd " + dir + "\r\n");
      await terminal.write(term.id, "opencode\r\n");
    };
    return btn;
  }

  private showButtonIfFileOpen(): void {
    const file = this.getActiveFile();
    
    if (this.runBtn && this.runBtn.isConnected) {
      this.runBtn.remove();
      this.runBtn = null;
    }

    if (file?.path) {
      const $header = this.getHeader();
      if ($header) {
        this.runBtn = this.createRunButton();
        $header.appendChild(this.runBtn);
      }
    }
  }

  private setupRunButton(): void {
    if (!editorManager) return;
    
    const handleSwitch = this.showButtonIfFileOpen.bind(this);
    
    if (editorManager.isCodeMirror) {
      editorManager.on('switch-file', handleSwitch);
    } else if (editorManager.editor) {
      editorManager.editor.on('switch-file', handleSwitch);
    }

    setTimeout(() => this.showButtonIfFileOpen(), 500);
  }

  registerCommands(): void {
    if (!editorManager) return;
    
    const self = this;
    const commands = [
      { name: 'opencode-install', description: 'OpenCode: Install', exec: () => self.installOpenCode() },
      { name: 'opencode-version', description: 'OpenCode: Check Version', exec: () => self.checkVersion() },
      { name: 'opencode-update', description: 'OpenCode: Update', exec: () => self.updateOpenCode() },
      { name: 'opencode-uninstall', description: 'OpenCode: Uninstall', exec: () => self.uninstallOpenCode() },
      { name: 'opencode-menu', description: 'OpenCode: Show Menu', exec: () => self.showMenu() },
    ];

    if (editorManager.isCodeMirror) {
      const cmds = acode.require('commands') as { add: (name: string, desc: string, fn: () => void) => void };
      commands.forEach(cmd => cmds.add(cmd.name, cmd.description, cmd.exec));
    } else if (editorManager.editor) {
      const { commands: editorCommands } = editorManager.editor;
      commands.forEach(cmd => editorCommands.addCommand({ name: cmd.name, description: cmd.description, exec: cmd.exec }));
    }
  }

  async showMenu(): Promise<void> {
    const options = ['Install OpenCode', 'Check version', 'Update', 'Uninstall'];
    try {
      const action = await select('OpenCode Menu', options);
      if (!action) return;
      switch (action) {
        case 'Install OpenCode': await this.installOpenCode(); break;
        case 'Check version': await this.checkVersion(); break;
        case 'Update': await this.updateOpenCode(); break;
        case 'Uninstall': await this.uninstallOpenCode(); break;
      }
    } catch (e) { }
  }

  async installOpenCode(): Promise<void> {
    try {
      const confirmed = await confirm('Install OpenCode?', 'This will install OpenCode on Alpine Linux. Requires internet connection.');
      if (!confirmed) return;

      const term = await terminal.create({ name: 'Install OpenCode' });
      
      await terminal.write(term.id, "apk update\r\n");
      await terminal.write(term.id, "apk add curl bash nodejs npm libc6-compat git\r\n");
      await terminal.write(term.id, "npm uninstall -g opencode-ai 2>/dev/null\r\n");
      await terminal.write(term.id, "rm -f /usr/local/bin/opencode\r\n");
      await terminal.write(term.id, "mkdir -p ~/.local/share/opencode/bin\r\n");
      await terminal.write(term.id, "curl -fsSL https://opencode.ai/install | bash\r\n");
      await terminal.write(term.id, 'echo "export PATH=$HOME/.opencode/bin:$PATH" >> ~/.bashrc\r\n');
      await terminal.write(term.id, 'exit \r\n');

      alert('Installing OpenCode...', 'Wait for installation to complete. Follow the terminal output.');
    } catch (error) { alert('Error', String(error)); }
  }

  async checkVersion(): Promise<void> {
    try {
      const term = await terminal.create({ name: 'Check Version' });
      await terminal.write(term.id, "opencode --version \r\n");
    } catch (error) { alert('Error', String(error)); }
  }

  async updateOpenCode(): Promise<void> {
    try {
      const confirmed = await confirm('Update OpenCode?', 'This will update to the latest version.');
      if (!confirmed) return;

      const term = await terminal.create({ name: 'Update OpenCode' });
      await terminal.write(term.id, "npm update -g opencode-ai \r\n");
      await terminal.write(term.id, "opencode --version \r\n");
      await terminal.write(term.id, "exit \r\n");

      alert('Updating OpenCode...', 'Wait for update to complete.');
    } catch (error) { alert('Error', String(error)); }
  }

  async uninstallOpenCode(): Promise<void> {
    let confirmed: boolean;
    try { confirmed = await confirm('Uninstall OpenCode?', 'This will remove OpenCode from your device.'); }
    catch (e) { return; }
    if (!confirmed) return;
    try {
      const term = await terminal.create({ name: 'Uninstall OpenCode' });
      await terminal.write(term.id, "npm uninstall -g opencode-ai \r\n");
      await terminal.write(term.id, "rm -rf ~/.opencode \r\n");
      await terminal.write(term.id, "exit \r\n");
      alert('Success', 'OpenCode uninstalled.');
    } catch (error) { alert('Error', String(error)); }
  }

  async destroy(): Promise<void> {
    if (this.runBtn) {
      this.runBtn.onclick = null;
      this.runBtn.remove();
      this.runBtn = null;
    }

    if (!editorManager) return;
    
    const handleSwitch = this.showButtonIfFileOpen.bind(this);
    
    if (editorManager.isCodeMirror) {
      editorManager.off('switch-file', handleSwitch);
    } else if (editorManager.editor) {
      editorManager.editor.off('switch-file', handleSwitch);
    }

    const commandNames = [
      'opencode-install',
      'opencode-version',
      'opencode-update',
      'opencode-uninstall',
      'opencode-menu'
    ];

    if (editorManager.isCodeMirror) {
      const cmds = acode.require('commands') as { remove: (name: string) => void };
      commandNames.forEach(name => cmds.remove(name));
    } else if (editorManager.editor) {
      const { commands } = editorManager.editor;
      commandNames.forEach(name => commands.removeCommand(name));
    }
  }
}

const win = window as Window & { acode?: AcodeModule };
if (win.acode) {
  const opencodePlugin = new OpenCodeAlpinePlugin();
  win.acode.setPluginInit(plugin.id, async (baseUrl: string, $page: unknown, { cacheFileUrl, cacheFile }: { cacheFileUrl: string; cacheFile: unknown }) => {
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    opencodePlugin.baseUrl = baseUrl;
    await opencodePlugin.init();
  });
  win.acode.setPluginUnmount(plugin.id, () => opencodePlugin.destroy());
}

export {};