import { CHAINS_ENUM } from '@debank/common';
import clsx from 'clsx';

import {
  IconArrowDown,
  RcIconHistoryGoBack,
  RcIconHome,
  RcIconReload,
  RcIconShield,
  RcIconStopload,
} from '@/../assets/icons/top-bar';

import { detectClientOS } from '@/isomorphic/os';
import {
  useDappNavigation,
  useDetectDappVersion,
} from '@/renderer/hooks-shell/useDappNavigation';
import { Divider } from 'antd';
import classNames from 'classnames';
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { formatDappURLToShow } from '@/isomorphic/dapp';
import { useMatchURLBaseConfig } from '@/renderer/hooks-ipc/useAppDynamicConfig';
import { useFloatingCurrentAccountCompWidth } from '@/renderer/hooks-shell/useMainWindow';
import { useWindowState } from '@/renderer/hooks-shell/useWindowState';
import { useCurrentConnection } from '@/renderer/hooks/rabbyx/useConnection';
import { useZPopupLayerOnMain } from '@/renderer/hooks/usePopupWinOnMainwin';
import { useSwitchChainModal } from '@/renderer/hooks/useSwitchChainModal';
import { useGhostTooltip } from '@/renderer/routes-popup/TopGhostWindow/useGhostWindow';
import { findChain } from '@/renderer/utils/chain';
import { copyText } from '@/renderer/utils/clipboard';
import { useLocation } from 'react-router-dom';
import ChainIcon from '../ChainIcon';
import DarwinDraggableGasket from '../DarwinDraggableGasket';
import NavRefreshButton from './components/NavRefreshButton';
import styles from './index.module.less';
// import { TipsWrapper } from '../TipWrapper';

const isDarwin = detectClientOS() === 'darwin';

const RiskArea = ({
  style,
  iconColor,
}: React.PropsWithChildren<{
  style?: React.CSSProperties;
  iconColor?: string;
}>) => {
  return (
    <div style={style} className={styles.risk}>
      <RcIconShield
        style={{ ...(iconColor && { color: iconColor }) }}
        className={styles.icon}
      />
    </div>
  );
};

const ConnectedChain = forwardRef(
  (
    {
      chain,
      className,
      ...others
    }: {
      chain: CHAINS_ENUM;
    } & React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLDivElement>,
      HTMLDivElement
    >,
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    return (
      <div className={clsx(styles.chain, className)} ref={ref} {...others}>
        <ChainIcon
          className={styles.logo}
          chain={chain}
          isShowCustomRPC
          showCustomRPCToolTip
          isShowTooltipOnTop
        />
        <span className={styles.chainName}>
          {findChain({ enum: chain })?.name}
        </span>
        <img src={IconArrowDown} alt="" />
      </div>
    );
  }
);

function DarwinGasket() {
  const { fixedFloatingCurrentAccountCompWidth } =
    useFloatingCurrentAccountCompWidth();

  if (!isDarwin) return null;

  return (
    <DarwinDraggableGasket
      className={styles.draggableGasket}
      style={
        !fixedFloatingCurrentAccountCompWidth
          ? {}
          : {
              maxWidth: `calc(100% - var(--left-navbar-w) - var(--left-navbar-close-w) - ${fixedFloatingCurrentAccountCompWidth}px)`,
            }
      }
    />
  );
}

export const TopNavBar = () => {
  const [nonce, setNonce] = useState(0);

  const { navActions, selectedTabInfo, activeTab } = useDappNavigation();

  const { switchChain, currentSite } = useCurrentConnection(
    {
      id: activeTab?.id,
      url: activeTab?.url,
    },
    nonce
  );

  const handleCloseTab = useCallback(() => {
    if (activeTab?.id) {
      chrome.tabs.remove(activeTab?.id);
    }
  }, [activeTab?.id]);

  const { ref: divRef, open } = useSwitchChainModal<HTMLDivElement>((chain) => {
    switchChain(chain);
  });

  const { navTextColor, navIconColor, navDividerColor, navBackgroundColor } =
    useMatchURLBaseConfig(activeTab?.url);

  const { onDarwinToggleMaxmize } = useWindowState();

  useEffect(
    () =>
      window.rabbyDesktop.ipcRenderer.on(
        '__internal_push:rabbyx:session-broadcast-forward-to-desktop',
        (payload) => {
          if (payload.event !== 'createSession') return;
          const { data } = payload;
          const [tabId] = data.split('-');
          if (Number(tabId) === activeTab?.id) {
            setNonce(nonce + 1);
          }
        }
      ),
    [nonce, activeTab]
  );

  const dappURLToShow = useMemo(() => {
    if (selectedTabInfo?.dapp?.type === 'localfs') {
      return formatDappURLToShow(selectedTabInfo?.dapp?.id || '');
    }
    return formatDappURLToShow(activeTab?.url || '');
  }, [selectedTabInfo?.dapp, activeTab?.url]);

  const [{ showTooltip, destroyTooltip }] = useGhostTooltip({
    mode: 'controlled',
    defaultTooltipProps: {
      title: 'You should never see this tooltip',
      placement: 'bottom',
    },
  });
  const autoHideOnMouseLeaveRef = useRef(true);
  const hoverPosition = useRef<any>();

  const autoHideTimer = useRef<NodeJS.Timeout>();

  const l = useLocation();

  useEffect(
    () => () => {
      destroyTooltip(0);
      autoHideOnMouseLeaveRef.current = true;
      clearInterval(autoHideTimer.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [l]
  );

  const { dappVersion, confirmDappVersion } =
    useDetectDappVersion(selectedTabInfo);

  const zActions = useZPopupLayerOnMain();

  return (
    <div className={styles.main} onDoubleClick={onDarwinToggleMaxmize}>
      <div className={styles.leftWrapper}>
        <div
          className={styles.left}
          style={{
            ...(navBackgroundColor && { backgroundColor: navBackgroundColor }),
          }}
          data-nodrag
          onDoubleClick={(evt) => {
            evt.stopPropagation();
          }}
        >
          <RiskArea style={{ color: navTextColor }} iconColor={navIconColor} />
          <Divider
            type="vertical"
            className={classNames(styles.divider)}
            style={{ ...(navIconColor && { borderColor: navDividerColor }) }}
          />
          {activeTab?.status === 'loading' && (
            <img
              className={styles.loadingIcon}
              src="rabby-internal://assets/icons/top-bar/icon-dapp-nav-loading.svg"
            />
          )}
          <div
            className={clsx(styles.url, 'h-[100%] flex items-center')}
            style={{ ...(navTextColor && { color: navTextColor }) }}
          >
            <span
              className={clsx(
                styles.copyTrigger,
                'h-[100%] inline-flex items-center'
              )}
              onClick={async () => {
                if (!dappURLToShow) return;
                await copyText(dappURLToShow);

                showTooltip(
                  // adjust the position based on the rect of trigger element
                  {
                    ...hoverPosition.current,
                  },
                  {
                    title: 'Copied',
                    placement: 'bottom',
                  },
                  { autoDestroyTimeout: 3000 }
                );
                autoHideOnMouseLeaveRef.current = false;
                autoHideTimer.current = setTimeout(() => {
                  autoHideOnMouseLeaveRef.current = true;
                  destroyTooltip(0);
                }, 3000);
              }}
              onMouseEnter={(event) => {
                if (!dappURLToShow) return;
                if (!autoHideOnMouseLeaveRef.current) return;

                const rect = (event.target as HTMLDivElement)
                  .getBoundingClientRect()
                  .toJSON();

                hoverPosition.current = {
                  ...rect,
                  left: Math.min(event.clientX, rect.x + rect.width - 30),
                  top: rect.y + 20,
                  height: 5,
                  width: 30,
                };

                showTooltip(
                  // adjust the position based on the rect of trigger element
                  {
                    ...hoverPosition.current,
                  },
                  {
                    title: 'Copy URL',
                    placement: 'bottom',
                  }
                );
              }}
              onMouseLeave={() => {
                if (autoHideOnMouseLeaveRef.current) {
                  destroyTooltip(0);
                }
              }}
            >
              {dappURLToShow}
            </span>
          </div>
          <div className={clsx(styles.historyBar)}>
            <RcIconHistoryGoBack
              style={{ color: navIconColor }}
              className={clsx(
                styles.goBack,
                selectedTabInfo?.canGoBack && styles.active
              )}
              onClick={navActions.onGoBackButtonClick}
            />
            <RcIconHistoryGoBack
              style={{ color: navIconColor }}
              className={clsx(
                styles.goForward,
                selectedTabInfo?.canGoForward && styles.active
              )}
              onClick={navActions.onGoForwardButtonClick}
            />
            <NavRefreshButton
              className={styles.detectDappIcon}
              btnStatus={
                activeTab?.status === 'loading'
                  ? 'loading'
                  : dappVersion.updated
                  ? 'dapp-updated'
                  : undefined
              }
              normalRefreshBtn={
                <RcIconReload
                  className="w-[100%] h-[100%]"
                  style={{ color: navIconColor }}
                  onClick={navActions.onReloadButtonClick}
                />
              }
              stopLoadingBtn={
                <RcIconStopload
                  className="w-[100%] h-[100%]"
                  style={{ color: navIconColor }}
                  onClick={navActions.onStopLoadingButtonClick}
                />
              }
              onForceReload={() => {
                navActions.onForceReloadButtonClick();
                confirmDappVersion();

                setTimeout(() => {
                  zActions.showZSubview('toast-zpopup-message', {
                    type: 'success',
                    message: 'Updated',
                  });
                }, 1000);
              }}
            />
            <RcIconHome
              style={{ color: navIconColor }}
              onClick={navActions.onHomeButtonClick}
            />
          </div>
          <div className={styles.connectChainBox}>
            <ConnectedChain
              ref={divRef}
              chain={currentSite ? currentSite.chain : CHAINS_ENUM.ETH}
              onClick={() => {
                open({
                  value: currentSite ? currentSite.chain : CHAINS_ENUM.ETH,
                  isCheckCustomRPC: true,
                });
              }}
            />
          </div>
        </div>
        <div className={styles.close} onClick={handleCloseTab}>
          <img src="rabby-internal://assets/icons/top-bar/close.svg" />
        </div>
        {isDarwin && <DarwinGasket />}
      </div>
    </div>
  );
};
