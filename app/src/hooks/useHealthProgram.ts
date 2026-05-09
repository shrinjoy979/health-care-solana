import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
// import {
//   getAssociatedTokenAddress,
//   TOKEN_PROGRAM_ID,
// } from "@solana/spl-token";
import idl from "../idl.json";

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";

// ── Constants ──────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey("B3hcYp5nnHH8iWXoEsF2UJpNy82fi7thTHeKJBoNq4pa");
const PATIENT_SEED      = Buffer.from("patient");
const PRACTITIONER_SEED = Buffer.from("practitioner");
const PROTOCOL_SEED     = Buffer.from("protocol");
const POT_SEED          = Buffer.from("stake_pot");

// ── Types ──────────────────────────────────────────────────────────────────
export type PatientProfile = {
  wallet: PublicKey;
  healthScore: number;
  baselineScore: number;
  totalStaked: number;
  totalEarned: number;
  activePots: number;
  sessionCount: number;
  registeredAt: number;
};

export type StakePot = {
  publicKey: PublicKey;
  patient: PublicKey;
  practitioner: PublicKey;
  patientStaked: number;
  practitionerStaked: number;
  totalAmount: number;
  patientShareBps: number;
  practitionerShareBps: number;
  baselineHealthScore: number;
  currentHealthScore: number;
  sessionCount: number;
  status: string;
  expiresAt: number;
};

export type ProtocolState = {
  totalPatients: number;
  totalPractitioners: number;
  totalPots: number;
  totalSlashed: number;
  totalRewarded: number;
  healthMint: PublicKey;
  treasury: PublicKey | null;
};

// ── Hook ───────────────────────────────────────────────────────────────────
export function useHealthProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [program,        setProgram]        = useState<Program | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [activePots,     setActivePots]     = useState<StakePot[]>([]);
  const [protocolState,  setProtocolState]  = useState<ProtocolState | null>(null);
  const [treasuryPubkey, setTreasuryPubkey] = useState<PublicKey | null>(null);
  const [healthBalance,  setHealthBalance]  = useState<number>(0);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // ── Init program ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      setProgram(new Program(idl as any, provider));
    } catch (e: any) {
      console.error("Failed to init program:", e);
      setError(e.message);
    }
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    if (program && wallet.publicKey) fetchAll();
  }, [program, wallet.publicKey]);

  // ── fetchAll ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!program || !wallet.publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const mint = await fetchProtocolState(program);
      if (mint && wallet.publicKey) {
        await fetchTokenBalance(mint, wallet.publicKey);
      }
      await fetchPatientProfile(program);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey]);

  // ── Resolve treasury from on-chain data ───────────────────────────────────
  // Strategy 1: read `acc.treasury` if you added that field to ProtocolState
  // Strategy 2: discover via getTokenAccountsByOwner (protocol PDA owns treasury)
  const resolveTreasury = useCallback(async (
    acc: any,
    mint: PublicKey,
    protocolPda: PublicKey,
  ): Promise<PublicKey> => {
    // Strategy 1 — stored field (works after you add `treasury: Pubkey` to ProtocolState)
    const defaultPk = PublicKey.default.toBase58();
    if (acc.treasury && acc.treasury.toBase58() !== defaultPk) {
      console.log("[treasury] from ProtocolState field:", acc.treasury.toBase58());
      return acc.treasury as PublicKey;
    }

    // Strategy 2 — discover by owner
    const tokenAccounts = await connection.getTokenAccountsByOwner(protocolPda, {
      mint,
      programId: TOKEN_PROGRAM_ID,
    });

    if (tokenAccounts.value.length === 0) {
      throw new Error(
        "Treasury not found. " +
        "Ensure initialize_protocol has been called on-chain. " +
        "Protocol PDA: " + protocolPda.toBase58()
      );
    }

    const treasury = tokenAccounts.value[0].pubkey;
    console.log("[treasury] discovered via owner lookup:", treasury.toBase58());
    return treasury;
  }, [connection]);

  // ── fetchProtocolState ────────────────────────────────────────────────────
  const fetchProtocolState = useCallback(async (prog: Program): Promise<PublicKey | null> => {
    try {
      const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
      const acc = await (prog.account as any).protocolState.fetch(protocolPda);
      const mint: PublicKey = acc.healthMint;

      const treasury = await resolveTreasury(acc, mint, protocolPda);
      setTreasuryPubkey(treasury);

      setProtocolState({
        totalPatients:      new BN(acc.totalPatients).toNumber(),
        totalPractitioners: new BN(acc.totalPractitioners).toNumber(),
        totalPots:          new BN(acc.totalPots).toNumber(),
        totalSlashed:       new BN(acc.totalSlashed).toNumber() / 1_000_000,
        totalRewarded:      new BN(acc.totalRewarded).toNumber() / 1_000_000,
        healthMint: mint,
        treasury,
      });

      return mint;
    } catch (e) {
      console.error("fetchProtocolState failed:", e);
      setProtocolState(null);
      return null;
    }
  }, [resolveTreasury]);

  // ── fetchTokenBalance ─────────────────────────────────────────────────────
  const fetchTokenBalance = useCallback(async (
    mint: PublicKey,
    walletPubkey: PublicKey,
  ) => {
    try {
      const ata = await getAssociatedTokenAddress(mint, walletPubkey);
      const bal = await connection.getTokenAccountBalance(ata);
      setHealthBalance(Number(bal.value.uiAmount ?? 0));
    } catch {
      setHealthBalance(0);
    }
  }, [connection]);

  // ── fetchPatientProfile ───────────────────────────────────────────────────
  const fetchPatientProfile = useCallback(async (prog: Program) => {
    if (!wallet.publicKey) return;
    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [PATIENT_SEED, wallet.publicKey.toBuffer()],
        PROGRAM_ID
      );
      const acc = await (prog.account as any).patientProfile.fetch(pda);
      setPatientProfile({
        wallet:        acc.wallet,
        healthScore:   acc.healthScore,
        baselineScore: acc.baselineScore,
        totalStaked:   new BN(acc.totalStaked).toNumber()  / 1_000_000,
        totalEarned:   new BN(acc.totalEarned).toNumber()  / 1_000_000,
        activePots:    acc.activePots,
        sessionCount:  acc.sessionCount,
        registeredAt:  new BN(acc.registeredAt).toNumber(),
      });
      await fetchActivePots(prog, wallet.publicKey);
    } catch {
      setPatientProfile(null);
    }
  }, [wallet.publicKey]);

  // ── fetchActivePots ───────────────────────────────────────────────────────
  const fetchActivePots = useCallback(async (
    prog: Program,
    walletPubkey: PublicKey,
  ) => {
    try {
      const allPots = await (prog.account as any).stakePot.all([
        { memcmp: { offset: 8, bytes: walletPubkey.toBase58() } },
      ]);
      setActivePots(allPots.map((p: any) => ({
        publicKey:            p.publicKey,
        patient:              p.account.patient,
        practitioner:         p.account.practitioner,
        patientStaked:        new BN(p.account.patientStaked).toNumber()      / 1_000_000,
        practitionerStaked:   new BN(p.account.practitionerStaked).toNumber() / 1_000_000,
        totalAmount:          new BN(p.account.totalAmount).toNumber()         / 1_000_000,
        patientShareBps:      p.account.patientShareBps,
        practitionerShareBps: p.account.practitionerShareBps,
        baselineHealthScore:  p.account.baselineHealthScore,
        currentHealthScore:   p.account.currentHealthScore,
        sessionCount:         p.account.sessionCount,
        status:               Object.keys(p.account.status)[0],
        expiresAt:            new BN(p.account.expiresAt).toNumber(),
      })));
    } catch {
      setActivePots([]);
    }
  }, []);

  // ── registerPatient ───────────────────────────────────────────────────────
  // const registerPatient = useCallback(async (name: string) => {
  //   if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

  //   const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
  //   const [patientPda]  = PublicKey.findProgramAddressSync(
  //     [PATIENT_SEED, wallet.publicKey.toBuffer()], PROGRAM_ID
  //   );

  //   // Always re-fetch fresh so we have latest mint + can resolve treasury
  //   const acc  = await (program.account as any).protocolState.fetch(protocolPda);
  //   const mint: PublicKey = acc.healthMint;

  //   // Use cached treasury if available, otherwise discover
  //   const treasury = treasuryPubkey ?? await resolveTreasury(acc, mint, protocolPda);
  //   if (!treasuryPubkey) setTreasuryPubkey(treasury);

  //   console.log("registerPatient — treasury:", treasury.toBase58(), "mint:", mint.toBase58());

  //   const nameHash = Array.from(
  //     new Uint8Array(
  //       await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name))
  //     )
  //   );

  //   const patientAta = await getAssociatedTokenAddress(mint, wallet.publicKey);

  //   setLoading(true);
  //   try {
  //     const tx = await (program.methods as any)
  //       .registerPatient(nameHash, new BN(500_000_000))
  //       .accounts({
  //         patientProfile:      patientPda,
  //         patientTokenAccount: patientAta,
  //         protocolState:       protocolPda,
  //         treasury,
  //         healthMint:          mint,
  //         patientWallet:       wallet.publicKey,
  //       })
  //       .rpc();

  //     console.log("Registered! tx:", tx);
  //     await fetchAll();
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [program, wallet.publicKey, connection, treasuryPubkey, resolveTreasury, fetchAll]);


const registerPatient = useCallback(async (name: string) => {
  if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

  const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
  const [patientPda]  = PublicKey.findProgramAddressSync(
    [PATIENT_SEED, wallet.publicKey.toBuffer()], PROGRAM_ID
  );

  const acc  = await (program.account as any).protocolState.fetch(protocolPda);
  const mint: PublicKey = acc.healthMint;

  const treasury = treasuryPubkey ?? await resolveTreasury(acc, mint, protocolPda);
  if (!treasuryPubkey) setTreasuryPubkey(treasury);

  const nameHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name))
    )
  );

  const patientAta = await getAssociatedTokenAddress(mint, wallet.publicKey);

  // ── Step 1: create ATA if it doesn't exist yet ──────────────────────────
  const ataInfo = await connection.getAccountInfo(patientAta);
  if (!ataInfo) {
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,          // payer
        patientAta,                // ata address
        wallet.publicKey,          // owner
        mint,                      // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      )
    );
    const { blockhash } = await connection.getLatestBlockhash();
    createAtaTx.recentBlockhash = blockhash;
    createAtaTx.feePayer = wallet.publicKey;

    const signed = await wallet.signTransaction!(createAtaTx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    console.log("ATA created:", sig);
  }

  // ── Step 2: register patient ─────────────────────────────────────────────
  setLoading(true);
  try {
    const tx = await (program.methods as any)
      .registerPatient(nameHash, new BN(500_000_000))
      .accounts({
        patientProfile:      patientPda,
        patientTokenAccount: patientAta,
        protocolState:       protocolPda,
        treasury,
        healthMint:          mint,
        patientWallet:       wallet.publicKey,
      })
      .rpc();

    console.log("Registered! tx:", tx);
    await fetchAll();
  } finally {
    setLoading(false);
  }
}, [program, wallet, connection, treasuryPubkey, resolveTreasury, fetchAll]);

  // ── openStakePot ──────────────────────────────────────────────────────────
  const openStakePot = useCallback(async (
    practitionerWallet: PublicKey,
    patientStake: number,
    practitionerStake: number,
    durationDays: number,
  ) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    try {
      const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
      const [patientPda]  = PublicKey.findProgramAddressSync(
        [PATIENT_SEED, wallet.publicKey.toBuffer()], PROGRAM_ID
      );
      const [pracPda] = PublicKey.findProgramAddressSync(
        [PRACTITIONER_SEED, practitionerWallet.toBuffer()], PROGRAM_ID
      );
      const [potPda] = PublicKey.findProgramAddressSync(
        [POT_SEED, wallet.publicKey.toBuffer(), practitionerWallet.toBuffer()], PROGRAM_ID
      );

      const acc  = await (program.account as any).protocolState.fetch(protocolPda);
      const mint: PublicKey = acc.healthMint;

      const patientAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
      const pracAta    = await getAssociatedTokenAddress(mint, practitionerWallet);

      const tx = await (program.methods as any)
        .openStakePot(
          new BN(patientStake      * 1_000_000),
          new BN(practitionerStake * 1_000_000),
          durationDays,
        )
        .accounts({
          stakePot:                 potPda,
          patientProfile:           patientPda,
          practitionerProfile:      pracPda,
          patientTokenAccount:      patientAta,
          practitionerTokenAccount: pracAta,
          protocolState:            protocolPda,
          healthMint:               mint,
          patientWallet:            wallet.publicKey,
          practitionerWallet,
        })
        .rpc();

      console.log("Stake pot opened:", tx);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey, fetchAll]);

  return {
    program,
    patientProfile,
    activePots,
    protocolState,
    healthBalance,
    loading,
    error,
    isRegistered: patientProfile !== null,
    registerPatient,
    openStakePot,
    refetch: fetchAll,
  };
}