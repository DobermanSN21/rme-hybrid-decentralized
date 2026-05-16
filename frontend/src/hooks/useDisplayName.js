// hooks/useDisplayName.js
import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { getDisplayName } from "../services/blockchain";

export function useDisplayName(address) {
    const { account } = useWallet();
    const [name, setName] = useState("");

    useEffect(() => {
        if (!account || !address) return;
        getDisplayName(account.signer, address).then(n => setName(n || "")).catch(() => {});
    }, [account, address]);

    return name;
}

export function useDisplayNames(addresses) {
    const { account } = useWallet();
    const [namesMap, setNamesMap] = useState({});

    useEffect(() => {
        if (!account || !addresses?.length) return;
        const unique = [...new Set(addresses.filter(Boolean))];
        Promise.all(unique.map(a => getDisplayName(account.signer, a).then(n => [a.toLowerCase(), n || ""]))).then(entries => {
            setNamesMap(Object.fromEntries(entries));
        }).catch(() => {});
    }, [account, addresses?.join(",")]);

    return namesMap;
}
