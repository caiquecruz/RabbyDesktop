/// <reference path="../renderer/preload.d.ts" />

import { createRoot } from 'react-dom/client';
import '@/renderer/css/style.less';

import './popup-view.less';
import '@/renderer/css/windicss';
import '@/renderer/ipcRequest/zPopupMessage';

import { parseQueryString } from '@/isomorphic/url';
import { ShellWalletProvider } from '@/renderer/components/ShellWallet';

import MainWindowAddressManagement from '@/renderer/routes-popup/MainWindowAddressManagement';
import MainWindowAddAddress from '@/renderer/routes-popup/MainWindowAddAddress';
import ZPopupLayer from '@/renderer/routes-popup/ZPopupLayer';

const container = document.getElementById('root')!;
const root = createRoot(container);

switch (parseQueryString().view) {
  case 'address-management':
    root.render(
      <ShellWalletProvider>
        <MainWindowAddressManagement />
      </ShellWalletProvider>
    );
    break;
  case 'add-address':
    root.render(
      <ShellWalletProvider>
        <MainWindowAddAddress />
      </ShellWalletProvider>
    );
    break;
  case 'z-popup': {
    root.render(
      <ShellWalletProvider>
        <ZPopupLayer />
      </ShellWalletProvider>
    );
    break;
  }
  default:
    throw new Error('Unknown view');
    break;
}
