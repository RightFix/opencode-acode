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
  private sideBtn: { show: () => void; hide: () => void } | null = null;

  async init(): Promise<void> {
    const win = window as Window & { acode?: AcodeModule; editorManager?: EditorManager };
    acode = win.acode as AcodeModule;
    editorManager = win.editorManager as EditorManager;
    
    alert = acode.require('alert') as AcodeAlert;
    confirm = acode.require('confirm') as AcodeConfirm;
    select = acode.require('select') as AcodeSelect;
    terminal = acode.require('terminal') as TerminalModule;

    this.registerCommands();
    this.setupSideButton();
  }

  private getDirectory(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    let newPath = parts.join('/') || '/';
    if (newPath.includes('files/alpine/home')) {
      const paths = newPath.split('files/alphine/home')
      newPath = paths[1] || ''
    }
    else {
      const paths = newPath.split('storage/emulated/0')
      newPath = `../sdcard${paths[1]}`
    }
    return newPath
  }

  private getHeader(): HTMLElement | null {
    const root = document.querySelector("#root");
    return root?.querySelector('header') as HTMLElement | null;
  }

  private setupSideButton(): void {
    const self = this;
    const SideButton = acode.require('sideButton') as (options: {
      text: string;
      icon: string;
      onclick: () => void | Promise<void>;
      backgroundColor?: string;
      textColor?: string;
    }) => { show: () => void; hide: () => void };

    const runOpenCode = async () => {
      let filePath = '';
      
      const file = editorManager.activeFile as { path?: string; uri?: string; location?: string } | null;
      if (file?.path) filePath = file.path;
      else if (file?.uri) filePath = file.uri;
      else if (file?.location) filePath = file.location;
      
      if (!filePath && editorManager.editor) {
        const editorView = editorManager.editor as { state?: { doc?: { toString?: () => string } } };
        if (editorView.state?.doc?.toString) {
          alert('OpenCode', 'Editor active but no file path. Using default directory.');
          const term = await terminal.create({ name: 'OpenCode' });
          await terminal.write(term.id, "opencode\r\n");
          return;
        }
      }
      
      if (!filePath) {
        alert('OpenCode', 'No file open. File: ' + JSON.stringify(file));
        return;
      }
      
      const dir = self.getDirectory(filePath);
      const term = await terminal.create({ name: 'OpenCode' });
      await terminal.write(term.id, "cd " + dir + "\r\n");
      await terminal.write(term.id, "opencode\r\n");
    };

    this.sideBtn = SideButton({
      text: 'OpenCode',
      icon: 'opencode-icon',
      onclick: runOpenCode,
      backgroundColor: '#4CAF50',
      textColor: '#fff',
    });

    this.sideBtn.show();
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
    if (this.sideBtn) {
      this.sideBtn.hide();
      this.sideBtn = null;
    }

    if (!editorManager) return;
    
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