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

interface CommandsModule {
  addCommand?: (cmd: AcodeCommand) => void;
  removeCommand?: (name: string) => void;
  registry?: {
    add: (cmd: AcodeCommand) => void;
    remove: (name: string) => void;
  };
}

interface AcodeModule {
  require: (module: string) => unknown;
  addCommand?: (cmd: AcodeCommand) => void;
  removeCommand?: (name: string) => void;
  addIcon?: (name: string, src: string) => void;
  toast?: Toast;
  setPluginInit: (id: string, initFn: (baseUrl: string, $page: unknown, ctx: { cacheFileUrl: string; cacheFile: unknown }) => Promise<void>) => void;
  setPluginUnmount: (id: string, unmountFn: () => void) => void;
}

interface Toast {
  (message: string, duration?: number): void;
}

let toast: Toast;

let acode: AcodeModule;
let editorManager: EditorManager;
let alert: AcodeAlert;
let confirm: AcodeConfirm;
let select: AcodeSelect;
let terminal: TerminalModule;

class OpenCodeAlpinePlugin {
  private sideBtn: { show: () => void; hide: () => void } | null = null;

  async init(): Promise<void> {
    const win = window as Window & { acode?: AcodeModule; editorManager?: EditorManager };
    acode = win.acode as AcodeModule;
    editorManager = win.editorManager as EditorManager;
    
    alert = acode.require('alert') as AcodeAlert;
    confirm = acode.require('confirm') as AcodeConfirm;
    select = acode.require('select') as AcodeSelect;
    terminal = acode.require('terminal') as TerminalModule;
    toast = acode.require('toast') as Toast;

    this.registerCommands();
    this.setupSideButton();
  }

  private getDirectory(filePath: string): string | null {
    const parts = filePath.split('/');
    parts.pop();
    let newPath = parts.join('/') || '/';
    if (newPath.includes('files/alpine/home')) {
      const paths = newPath.split('files/alpine/home')
      newPath = paths[1] || ''
    }
    else {
      const paths = newPath.split('storage/emulated/0')
      newPath = `../sdcard${paths[1]}`
    }
    return newPath
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

    // Register the side-button icon so it renders on all Acode builds
    try {
      const iconName = 'opencode-icon';
      if (typeof acode.addIcon === 'function') {
        acode.addIcon(iconName, 'https://opencode.ai/favicon.svg');
      }
    } catch { /* icon registration is optional */ }

    const runOpenCode = async () => {
      const file = editorManager.activeFile as { path?: string; uri?: string; location?: string } | null;
      const filePath = file?.path ?? file?.uri ?? file?.location ?? '';
      
      if (!filePath && editorManager.editor) {
        const editorView = editorManager.editor as { state?: { doc?: { toString?: () => string } } };
        if (editorView.state?.doc?.toString) {
          alert('OpenCode', 'Editor active but no file path.');
          const term = await terminal.create({ name: 'OpenCode' });
          await terminal.write(term.id, "opencode\r\n");
          return;
        }
      }
      
      if (!filePath) {
        alert('OpenCode', 'No file open.');
        return;
      }
      
      const dir = self.getDirectory(filePath);
      if (!dir) {
        alert('OpenCode', 'Could not determine a directory for this file.');
        return;
      }
      
      try {
        const term = await terminal.create({ name: 'OpenCode' });
        // Quote path so spaces/special characters do not break cd
        await terminal.write(term.id, `cd "${dir}"\r\n`);
        await terminal.write(term.id, "opencode\r\n");
      } catch (e) {
        alert('Error', String(e));
      }
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
    const commands: AcodeCommand[] = [
      { name: 'opencode-install', description: 'OpenCode: Install', exec: () => self.installOpenCode() },
      { name: 'opencode-version', description: 'OpenCode: Check Version', exec: () => self.checkVersion() },
      { name: 'opencode-update', description: 'OpenCode: Update', exec: () => self.updateOpenCode() },
      { name: 'opencode-uninstall', description: 'OpenCode: Uninstall', exec: () => self.uninstallOpenCode() },
      { name: 'opencode-menu', description: 'OpenCode: Show Menu', exec: () => self.showMenu() },
    ];

    // Modern Acode (CodeMirror): acode.require('commands').addCommand({name, description, exec})
    try {
      const cmds = acode.require('commands') as CommandsModule | null | undefined;
      if (cmds && typeof cmds.addCommand === 'function') {
        commands.forEach(cmd => cmds.addCommand!(cmd));
        return;
      }
      if (cmds && cmds.registry && typeof cmds.registry.add === 'function') {
        commands.forEach(cmd => cmds.registry!.add(cmd));
        return;
      }
    } catch { /* module missing on legacy builds, fall through */ }

    try {
      if (typeof acode.addCommand === 'function') {
        commands.forEach(cmd => acode.addCommand!(cmd));
        return;
      }
    } catch { /* fall through */ }

    // Legacy Acode (Ace): editorManager.editor.commands.addCommand(...)
    try {
      const editorCommands = editorManager.editor?.commands;
      if (editorCommands && typeof editorCommands.addCommand === 'function') {
        commands.forEach(cmd => editorCommands.addCommand({ name: cmd.name, description: cmd.description, exec: cmd.exec }));
      }
    } catch (e) { console.error('OpenCode: command registration failed', e); }
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
      const confirmed = await confirm('Install OpenCode?', 'This will install OpenCode via npm. Requires internet connection.');
      if (!confirmed) return;

      const term = await terminal.create({ name: 'Install OpenCode' });
      await terminal.write(term.id, "apk update\r\n");
      await terminal.write(term.id, "apk add nodejs npm git libc6-compat\r\n");
      await terminal.write(term.id, "npm install -g opencode-ai\r\n");
      await terminal.write(term.id, "opencode --version\r\n");
      await terminal.write(term.id, 'exit \r\n');
      toast('Installing OpenCode...');
    } catch (error) { toast('Error: ' + String(error)); }
  }

  async checkVersion(): Promise<void> {
    try {
      const term = await terminal.create({ name: 'Check Version' });
      await terminal.write(term.id, "opencode --version \r\n");
    } catch (error) { toast('Error: ' + String(error)); }
  }

  async updateOpenCode(): Promise<void> {
    try {
      const confirmed = await confirm('Update OpenCode?', 'This will update to the latest version via npm.');
      if (!confirmed) return;

      const term = await terminal.create({ name: 'Update OpenCode' });
      await terminal.write(term.id, "npm install -g opencode-ai@latest \r\n");
      await terminal.write(term.id, "opencode --version \r\n");
      await terminal.write(term.id, "exit \r\n");
      toast('Updating OpenCode...');
    } catch (error) { toast('Error: ' + String(error)); }
  }

  async uninstallOpenCode(): Promise<void> {
    let confirmed: boolean;
    try { confirmed = await confirm('Uninstall OpenCode?', 'This will remove OpenCode from your device.'); }
    catch (e) { return; }
    if (!confirmed) return;
    try {
      const term = await terminal.create({ name: 'Uninstall OpenCode' });
      await terminal.write(term.id, "npm uninstall -g opencode-ai \r\n");
      await terminal.write(term.id, "opencode --version || true\r\n");
      await terminal.write(term.id, "exit \r\n");
      toast('OpenCode uninstalled.');
    } catch (error) { toast('Uninstall failed: ' + String(error)); }
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

    try {
      const cmds = acode.require('commands') as CommandsModule | null | undefined;
      if (cmds && typeof cmds.removeCommand === 'function') {
        commandNames.forEach(name => cmds.removeCommand!(name));
        return;
      }
      if (cmds && cmds.registry && typeof cmds.registry.remove === 'function') {
        commandNames.forEach(name => cmds.registry!.remove(name));
        return;
      }
    } catch { /* fall through */ }

    try {
      if (typeof acode.removeCommand === 'function') {
        commandNames.forEach(name => acode.removeCommand!(name));
        return;
      }
    } catch { /* fall through */ }

    try {
      const editorCommands = editorManager.editor?.commands;
      if (editorCommands && typeof editorCommands.removeCommand === 'function') {
        commandNames.forEach(name => editorCommands.removeCommand(name));
      }
    } catch (e) { console.error('OpenCode: command removal failed', e); }
  }
}

const win = window as Window & { acode?: AcodeModule };
if (win.acode) {
  const opencodePlugin = new OpenCodeAlpinePlugin();
  win.acode.setPluginInit(plugin.id, async (_baseUrl: string, $page: unknown, { cacheFileUrl, cacheFile }: { cacheFileUrl: string; cacheFile: unknown }) => {
    await opencodePlugin.init();
  });
  win.acode.setPluginUnmount(plugin.id, () => opencodePlugin.destroy());
}

export {};