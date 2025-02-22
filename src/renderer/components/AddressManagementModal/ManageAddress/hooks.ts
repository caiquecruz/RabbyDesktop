import { useAccountToDisplay } from '@/renderer/hooks/rabbyx/useAccountToDisplay';
import { useAddressManagement } from '@/renderer/hooks/rabbyx/useAddressManagement';
import { walletController } from '@/renderer/ipcRequest/rabbyx';
import { sortAccountsByBalance } from '@/renderer/utils/account';
import {
  KEYRING_TYPE,
  WALLET_BRAND_CONTENT,
  WALLET_SORT_SCORE,
  WALLET_BRAND_CATEGORY,
  KEYRING_CLASS,
} from '@/renderer/utils/constant';
import { groupBy, omit } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';
import { useAsync } from 'react-use';

const { nanoid } = require('nanoid');

export type DisplayedAccount = IDisplayedAccountWithBalance & {
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};

export type TypeKeyringGroup = {
  name: string;
  index?: number;
  list: DisplayedAccount[];
  type: string;
  brandName?: string;
  publicKey?: string;
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};

export const getWalletTypeName = (s: string) => {
  if (s === KEYRING_TYPE.SimpleKeyring) {
    return 'Private Key';
  }
  if (s === KEYRING_TYPE.HdKeyring) {
    return 'Seed Phrase';
  }

  if (WALLET_BRAND_CONTENT[s as keyof typeof WALLET_BRAND_CONTENT]) {
    return WALLET_BRAND_CONTENT[s as keyof typeof WALLET_BRAND_CONTENT].name;
  }

  return s;
};

export const getTypeGroup = (arr: DisplayedAccount[]) => {
  return {
    name: getWalletTypeName(arr?.[0]?.brandName || arr?.[0].type),
    list: arr,
    type: arr?.[0].type,
    brandName: arr?.[0]?.brandName,
    publicKey: arr?.[0].publicKey,
    hdPathBasePublicKey: arr?.[0]?.hdPathBasePublicKey,
    hdPathType: arr?.[0]?.hdPathType,
  } as TypeKeyringGroup;
};

const getSortNum = (s: string) => WALLET_SORT_SCORE[s] || 999999;

const brandWallet = Object.values(WALLET_BRAND_CONTENT)
  .filter(Boolean)
  .sort((a, b) => getSortNum(a.brand) - getSortNum(b.brand));

const wallets = groupBy(brandWallet, 'category');

const sortMapping = {
  [WALLET_BRAND_CATEGORY.HARDWARE]: 10 ** 2,
  [WALLET_BRAND_CATEGORY.MOBILE]: 10 ** 4,
  [WALLET_BRAND_CATEGORY.INSTITUTIONAL]: 10 ** 6,
};

const DEFAULT_SCORE = 10 ** 8;

const sortScore = [
  ...wallets[WALLET_BRAND_CATEGORY.HARDWARE],
  ...wallets[WALLET_BRAND_CATEGORY.INSTITUTIONAL],
  ...wallets[WALLET_BRAND_CATEGORY.MOBILE],
].reduce(
  (pre, cur, index) => {
    pre[cur.brand] = sortMapping[cur.category] + index;
    return pre;
  },
  {
    [KEYRING_CLASS.MNEMONIC]: 1,
    [KEYRING_CLASS.PRIVATE_KEY]: 2,
    [KEYRING_CLASS.HARDWARE.LEDGER]: 3,
    [KEYRING_CLASS.HARDWARE.TREZOR]: 4,
    [KEYRING_CLASS.HARDWARE.GRIDPLUS]: 5,
    [KEYRING_CLASS.HARDWARE.ONEKEY]: 6,
    [KEYRING_CLASS.HARDWARE.KEYSTONE]: 7,
    [KEYRING_CLASS.HARDWARE.BITBOX02]: 8,
  }
);

const getWalletScore = (s: TypeKeyringGroup[]) => {
  return sortScore[s?.[0]?.brandName || s?.[0]?.type] || DEFAULT_SCORE;
};

export const useWalletTypeData = () => {
  const wallet = walletController;

  const { highlightedAddresses, removeAddress, getHighlightedAddressesAsync } =
    useAddressManagement();
  const { accountsList, loadingAccounts, getAllAccountsToDisplay } =
    useAccountToDisplay();

  const sortedRef = useRef(false);
  const sortIdList = useRef<string[]>([]);

  const [sortedAccountsList, watchSortedAccountsList] = useMemo(() => {
    const restAccounts = [...accountsList];
    let highlightedAccounts: typeof accountsList = [];
    let watchModeHighlightedAccounts: typeof accountsList = [];

    highlightedAddresses.forEach((highlighted) => {
      const idx = restAccounts.findIndex(
        (account) =>
          account.address === highlighted.address &&
          account.brandName === highlighted.brandName
      );
      if (idx > -1) {
        if (restAccounts[idx].type === KEYRING_CLASS.WATCH) {
          watchModeHighlightedAccounts.push(restAccounts[idx]);
        } else {
          highlightedAccounts.push(restAccounts[idx]);
        }
        restAccounts.splice(idx, 1);
      }
    });
    const data = groupBy(restAccounts, (e) =>
      e.type === KEYRING_CLASS.WATCH ? '1' : '0'
    );

    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);
    watchModeHighlightedAccounts = sortAccountsByBalance(
      watchModeHighlightedAccounts
    );

    return [
      highlightedAccounts.concat(data['0'] || []).filter((e) => !!e),
      watchModeHighlightedAccounts.concat(data['1'] || []).filter((e) => !!e),
    ];
  }, [accountsList, highlightedAddresses]);

  const { value, loading, error } = useAsync(async () => {
    const walletGroup = groupBy(sortedAccountsList, (a) => a.brandName);

    const hdKeyringGroup = groupBy(
      walletGroup[KEYRING_TYPE.HdKeyring],
      (a) => a.publicKey
    );

    const notEmptyHdKeyringList = Object.values(hdKeyringGroup).map((item) =>
      getTypeGroup(item)
    ) as TypeKeyringGroup[];

    const allClassAccounts = await wallet.getAllClassAccounts();

    const emptyHdKeyringList: TypeKeyringGroup[] = [];
    allClassAccounts
      ?.filter(
        (item) =>
          item.accounts.length === 0 && item.type === KEYRING_TYPE.HdKeyring
      )
      .forEach((item) => {
        emptyHdKeyringList.push({
          list: [] as DisplayedAccount[],
          name: getWalletTypeName(item.keyring.type),
          type: item.type,
          brandName: item.type,
          publicKey: item.publicKey,
        });
      });

    const hdKeyRingList = [
      ...notEmptyHdKeyringList,
      ...emptyHdKeyringList,
    ].sort((a, b) => b.list.length - a.list.length);

    const ledgerAccounts = await Promise.all(
      (walletGroup[KEYRING_CLASS.HARDWARE.LEDGER] || []).map(async (e) => {
        try {
          const res = await wallet.requestKeyring(
            KEYRING_CLASS.HARDWARE.LEDGER,
            'getAccountInfo',
            null,
            e.address
          );
          return {
            ...e,
            hdPathBasePublicKey: res.hdPathBasePublicKey,
            hdPathType: res.hdPathType,
          };
        } catch (err) {
          return { ...e, hdPathBasePublicKey: nanoid() };
        }
      })
    );

    const ledgersGroup = groupBy(ledgerAccounts, (a) => a.hdPathBasePublicKey);

    const ledgerList = Object.values(ledgersGroup)
      .sort((a, b) => b.length - a.length)
      .map((item) => getTypeGroup(item)) as TypeKeyringGroup[];

    const v = (
      Object.values({
        ...omit(walletGroup, [
          KEYRING_TYPE.WatchAddressKeyring,
          KEYRING_TYPE.HdKeyring,
          KEYRING_CLASS.HARDWARE.LEDGER,
        ]),
      }) as DisplayedAccount[][]
    ).map((item) => [getTypeGroup(item)]);

    v.push(hdKeyRingList, ledgerList);

    v.sort((a, b) => getWalletScore(a) - getWalletScore(b));

    if (watchSortedAccountsList.length) {
      v.push([
        {
          name: 'Watch Address',
          list: watchSortedAccountsList,
          type: KEYRING_TYPE.WatchAddressKeyring,
        },
      ]);
    }

    const list = v.flat();

    if (list.length && sortedRef.current === false) {
      sortedRef.current = true;
      sortIdList.current = list.map(
        (e) => e.type + e.brandName + e.hdPathBasePublicKey + e.publicKey
      );
    }

    const result = list.reduce((pre, cur) => {
      pre[cur.type + cur.brandName + cur.hdPathBasePublicKey + cur.publicKey] =
        cur;
      return pre;
    }, {} as Record<string, typeof list[number]>);

    sortIdList.current = sortIdList.current.filter((e) => !!result[e]);
    return [result, sortIdList.current] as const;
  }, [sortedAccountsList, watchSortedAccountsList, wallet]);

  useEffect(() => {
    getHighlightedAddressesAsync().then(getAllAccountsToDisplay);
    // avoid duplicated call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    console.error('manage address', error);
  }

  return {
    accountGroup: value,
    loading: loading || loadingAccounts,
    highlightedAddresses,
    getAllAccountsToDisplay,
    removeAddress,
  };
};
