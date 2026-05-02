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
  editor: {
    commands: {
      addCommand: (cmd: AcodeCommand) => void;
      removeCommand: (name: string) => void;
    };
    getActiveFile?: () => { path?: string } | null;
  };
  getActiveFile?: () => { path?: string } | null;
}

interface TabBar {
  addButton: (options: { icon?: string; title?: string; id?: string; iconState?: { SVG?: string } }) => HTMLElement;
}

declare const acode: {
  require: (module: string) => unknown;
  setPluginInit: (id: string, initFn: (baseUrl: string, $page: unknown, ctx: { cacheFileUrl: string; cacheFile: unknown }) => Promise<void>) => void;
  setPluginUnmount: (id: string, unmountFn: () => void) => void;
};

declare const editorManager: EditorManager;

let alert: AcodeAlert;
let confirm: AcodeConfirm;
let select: AcodeSelect;
let terminal: TerminalModule;

class OpenCodeAlpinePlugin {
  baseUrl = '';
  private headerButton: HTMLElement | null = null;

  async init(): Promise<void> {
    alert = acode.require('alert') as AcodeAlert;
    confirm = acode.require('confirm') as AcodeConfirm;
    select = acode.require('select') as AcodeSelect;
    terminal = acode.require('terminal') as TerminalModule;

    this.registerCommands();
    this.addHeaderButton();
  }

  private async getCurrentFilePath(): Promise<string | null> {
    try {
      if (editorManager.isCodeMirror) {
        const getActiveFile = editorManager.getActiveFile as () => { path?: string } | null;
        const file = getActiveFile?.();
        return file?.path || null;
      } else {
        const editor = (editorManager as EditorManager).editor;
        const getActiveFile = editor.getActiveFile as () => { path?: string } | null;
        const file = getActiveFile?.();
        return file?.path || null;
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

  private addHeaderButton(): void {
    try {
      const tabbar = acode.require('tabbar') as TabBar;
      if (tabbar?.addButton) {
        this.headerButton = tabbar.addButton({
          icon: '⚡',
          title: 'Run with OpenCode',
          id: 'opencode-run-btn'
        } as { icon: string; title: string; id: string });
        
        this.headerButton.addEventListener('click', async () => {
          const filePath = await this.getCurrentFilePath();
          if (!filePath) return;
          
          const dir = this.getDirectory(filePath);
          const term = await terminal.create({ name: 'OpenCode' });
          await terminal.write(term.id, "cd " + dir + "\r\n");
          await terminal.write(term.id, "opencode\r\n");
        });
      }
    } catch (e) {
      console.error('Failed to add header button:', e);
    }
  }

  registerCommands(): void {
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
    } else {
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
    } catch (e) { console.error('Menu error:', e); }
  }

  async installOpenCode(): Promise<void> {
    try {
      const confirmed = await confirm('Install OpenCode?', 'This will install OpenCode on Alpine Linux. Requires internet connection.');
      if (!confirmed) return;

      const term = await terminal.create({ name: 'Install OpenCode' });
      
      await terminal.write(term.id, "cp " + this.baseUrl + "src/opencode.sh /tmp/opencode.sh \r\n");
      await terminal.write(term.id, "chmod +x /tmp/opencode.sh \r\n");
      await terminal.write(term.id, "/tmp/opencode.sh \r\n");
      await terminal.write(term.id, "exit \r\n");

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
    } else {
      const { commands } = editorManager.editor;
      commandNames.forEach(name => commands.removeCommand(name));
    }
  }
}

if (window.acode) {
  const opencodePlugin = new OpenCodeAlpinePlugin();
  acode.setPluginInit(plugin.id, async (baseUrl: string, $page: unknown, { cacheFileUrl, cacheFile }: { cacheFileUrl: string; cacheFile: unknown }) => {
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    opencodePlugin.baseUrl = baseUrl;
    await opencodePlugin.init();
  });
  acode.setPluginUnmount(plugin.id, () => opencodePlugin.destroy());
}

export {};