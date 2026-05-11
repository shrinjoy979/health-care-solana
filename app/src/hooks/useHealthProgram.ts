import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../idl.json";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

const PROGRAM_ID         = new PublicKey("B3hcYp5nnHH8iWXoEsF2UJpNy82fi7thTHeKJBoNq4pa");
const PATIENT_SEED       = Buffer.from("patient");
const PRACTITIONER_SEED  = Buffer.from("practitioner");
const PROTOCOL_SEED      = Buffer.from("protocol");
const POT_SEED           = Buffer.from("stake_pot");

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type PractitionerProfile = {
  wallet: PublicKey;
  specialization: string;
  reputationScore: number;
  totalStaked: number;
  totalEarned: number;
  totalSlashed: number;
  activePots: number;
  completedSessions: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
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

export type UserRole = "patient" | "practitioner" | "both" | "none" | null;

// ─── Specialization helpers ───────────────────────────────────────────────────

export const SPECIALIZATIONS = [
  "PrimaryCare",
  "Cardiology",
  "Nutrition",
  "MentalHealth",
  "Oncology",
  "Orthopedics",
  "Dermatology",
  "Other",
] as const;

export type Specialization = typeof SPECIALIZATIONS[number];

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  PrimaryCare:  "Primary Care",
  Cardiology:   "Cardiology",
  Nutrition:    "Nutrition",
  MentalHealth: "Mental Health",
  Oncology:     "Oncology",
  Orthopedics:  "Orthopedics",
  Dermatology:  "Dermatology",
  Other:        "Other",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHealthProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [program,               setProgram]               = useState<Program | null>(null);
  const [patientProfile,        setPatientProfile]        = useState<PatientProfile | null | undefined>(undefined);
  const [practitionerProfile,   setPractitionerProfile]   = useState<PractitionerProfile | null | undefined>(undefined);
  const [activePots,            setActivePots]            = useState<StakePot[]>([]);
  const [protocolState,         setProtocolState]         = useState<ProtocolState | null>(null);
  const [treasuryPubkey,        setTreasuryPubkey]        = useState<PublicKey | null>(null);
  const [healthBalance,         setHealthBalance]         = useState<number>(0);
  const [loading,               setLoading]               = useState(false);
  const [error,                 setError]                 = useState<string | null>(null);

  // ── Init program ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setPatientProfile(undefined);
    setPractitionerProfile(undefined);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
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

  // ── Fetch all ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!program || !wallet.publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const mint = await fetchProtocolState(program);
      if (mint && wallet.publicKey) await fetchTokenBalance(mint, wallet.publicKey);
      await Promise.all([
        fetchPatientProfile(program),
        fetchPractitionerProfile(program),
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey]);

  // ── Resolve treasury ──────────────────────────────────────────────────────

  const resolveTreasury = useCallback(async (
    acc: any,
    mint: PublicKey,
    protocolPda: PublicKey,
  ): Promise<PublicKey> => {
    const defaultPk = PublicKey.default.toBase58();
    if (acc.treasury && acc.treasury.toBase58() !== defaultPk) {
      return acc.treasury as PublicKey;
    }
    const tokenAccounts = await connection.getTokenAccountsByOwner(protocolPda, {
      mint,
      programId: TOKEN_PROGRAM_ID,
    });
    if (tokenAccounts.value.length === 0) {
      throw new Error("Treasury not found. Protocol PDA: " + protocolPda.toBase58());
    }
    return tokenAccounts.value[0].pubkey;
  }, [connection]);

  // ── Fetch protocol state ──────────────────────────────────────────────────

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

  // ── Fetch token balance ───────────────────────────────────────────────────

  const fetchTokenBalance = useCallback(async (mint: PublicKey, walletPubkey: PublicKey) => {
    try {
      const ata = await getAssociatedTokenAddress(mint, walletPubkey);
      const bal = await connection.getTokenAccountBalance(ata);
      setHealthBalance(Number(bal.value.uiAmount ?? 0));
    } catch {
      setHealthBalance(0);
    }
  }, [connection]);

  // ── Fetch patient profile ─────────────────────────────────────────────────

  const fetchPatientProfile = useCallback(async (prog: Program) => {
    if (!wallet.publicKey) return;
    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [PATIENT_SEED, wallet.publicKey.toBuffer()], PROGRAM_ID
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

  // ── Fetch practitioner profile ────────────────────────────────────────────

  const fetchPractitionerProfile = useCallback(async (prog: Program) => {
    if (!wallet.publicKey) return;
    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [PRACTITIONER_SEED, wallet.publicKey.toBuffer()], PROGRAM_ID
      );
      const acc = await (prog.account as any).practitionerProfile.fetch(pda);
      setPractitionerProfile({
        wallet:             acc.wallet,
        specialization:     Object.keys(acc.specialization)[0],
        reputationScore:    acc.reputationScore,
        totalStaked:        new BN(acc.totalStaked).toNumber()        / 1_000_000,
        totalEarned:        new BN(acc.totalEarned).toNumber()        / 1_000_000,
        totalSlashed:       new BN(acc.totalSlashed).toNumber()       / 1_000_000,
        activePots:         acc.activePots,
        completedSessions:  acc.completedSessions,
        positiveOutcomes:   acc.positiveOutcomes,
        negativeOutcomes:   acc.negativeOutcomes,
        registeredAt:       new BN(acc.registeredAt).toNumber(),
      });
      await fetchPractitionerPots(prog, wallet.publicKey);
    } catch {
      setPractitionerProfile(null);
    }
  }, [wallet.publicKey]);

  // ── Fetch active pots (patient side) ─────────────────────────────────────

  const fetchActivePots = useCallback(async (prog: Program, walletPubkey: PublicKey) => {
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

  // ── Fetch practitioner pots (practitioner pubkey is at offset 8+32=40) ───

  const fetchPractitionerPots = useCallback(async (prog: Program, walletPubkey: PublicKey) => {
    try {
      const allPots = await (prog.account as any).stakePot.all([
        { memcmp: { offset: 8 + 32, bytes: walletPubkey.toBase58() } },
      ]);
      // Merge with existing activePots (don't overwrite patient pots)
      setActivePots(prev => {
        const existingKeys = new Set(prev.map(p => p.publicKey.toBase58()));
        const newPots = allPots
          .filter((p: any) => !existingKeys.has(p.publicKey.toBase58()))
          .map((p: any) => ({
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
          }));
        return [...prev, ...newPots];
      });
    } catch {
      // silently ignore
    }
  }, []);

  // ── Register patient ──────────────────────────────────────────────────────

  const registerPatient = useCallback(async (name: string) => {
    if (!program || !wallet.publicKey || !wallet.signTransaction)
      throw new Error("Wallet not connected");

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
    const ataInfo    = await connection.getAccountInfo(patientAta);
    const preInstructions = ataInfo ? [] : [
      createAssociatedTokenAccountInstruction(wallet.publicKey, patientAta, wallet.publicKey, mint),
    ];

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
          tokenProgram:        TOKEN_PROGRAM_ID,
          systemProgram:       SystemProgram.programId,
          rent:                SYSVAR_RENT_PUBKEY,
        })
        .preInstructions(preInstructions)
        .rpc({ commitment: "confirmed" });

      console.log("Patient registered! tx:", tx);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [program, wallet, connection, treasuryPubkey, resolveTreasury, fetchAll]);

  // ── Register practitioner ─────────────────────────────────────────────────

  const registerPractitioner = useCallback(async (
    name: string,
    specialization: Specialization,
  ) => {
    if (!program || !wallet.publicKey || !wallet.signTransaction)
      throw new Error("Wallet not connected");

    const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
    const [pracPda]     = PublicKey.findProgramAddressSync(
      [PRACTITIONER_SEED, wallet.publicKey.toBuffer()], PROGRAM_ID
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

    const pracAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
    const ataInfo = await connection.getAccountInfo(pracAta);
    const preInstructions = ataInfo ? [] : [
      createAssociatedTokenAccountInstruction(wallet.publicKey, pracAta, wallet.publicKey, mint),
    ];

    // Build the enum variant object expected by Anchor
    const specializationArg = { [specialization.charAt(0).toLowerCase() + specialization.slice(1)]: {} };

    setLoading(true);
    try {
      const tx = await (program.methods as any)
        .registerPractitioner(nameHash, specializationArg, new BN(500_000_000))
        .accounts({
          practitionerProfile:      pracPda,
          practitionerTokenAccount: pracAta,
          protocolState:            protocolPda,
          treasury,
          healthMint:               mint,
          practitionerWallet:       wallet.publicKey,
          tokenProgram:             TOKEN_PROGRAM_ID,
          systemProgram:            SystemProgram.programId,
          rent:                     SYSVAR_RENT_PUBKEY,
        })
        .preInstructions(preInstructions)
        .rpc({ commitment: "confirmed" });

      console.log("Practitioner registered! tx:", tx);
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [program, wallet, connection, treasuryPubkey, resolveTreasury, fetchAll]);

  // ── Open stake pot ────────────────────────────────────────────────────────

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

  // ── Derived role ──────────────────────────────────────────────────────────

  const userRole: UserRole = (() => {
    if (patientProfile === undefined || practitionerProfile === undefined) return null; // still loading
    const isPatient       = patientProfile !== null;
    const isPractitioner  = practitionerProfile !== null;
    if (isPatient && isPractitioner) return "both";
    if (isPatient)      return "patient";
    if (isPractitioner) return "practitioner";
    return "none";
  })();

  return {
    program,
    patientProfile,
    practitionerProfile,
    activePots,
    protocolState,
    healthBalance,
    loading,
    error,
    userRole,
    // Legacy compat
    isRegistered: (loading || patientProfile === undefined) ? null : patientProfile !== null,
    registerPatient,
    registerPractitioner,
    openStakePot,
    refetch: fetchAll,
  };
}