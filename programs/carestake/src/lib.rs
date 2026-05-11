use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("B3hcYp5nnHH8iWXoEsF2UJpNy82fi7thTHeKJBoNq4pa");

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
pub const HEALTH_TOKEN_DECIMALS: u8 = 6;
pub const MIN_STAKE_AMOUNT: u64 = 100_000_000;       // 100 $HEALTH
pub const MAX_HEALTH_SCORE: u8 = 100;
pub const BASELINE_HEALTH_SCORE: u8 = 50;
pub const SLASH_THRESHOLD: u8 = 60;
pub const SLASH_RATE_BPS: u64 = 1000;
pub const REWARD_RATE_BPS: u64 = 500;
pub const ORACLE_AUTHORITY_SEED: &[u8] = b"oracle";
pub const POT_SEED: &[u8] = b"stake_pot";
pub const PATIENT_SEED: &[u8] = b"patient";
pub const PRACTITIONER_SEED: &[u8] = b"practitioner";
pub const SESSION_SEED: &[u8] = b"session";

// ─────────────────────────────────────────────
//  Program
// ─────────────────────────────────────────────
#[program]
pub mod crypto_healthcare {
    use super::*;

    // ── Admin / Bootstrap ─────────────────────

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        initial_supply: u64,
    ) -> Result<()> {
        let protocol_ai = ctx.accounts.protocol_state.to_account_info();
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.authority = ctx.accounts.authority.key();
        protocol.health_mint = ctx.accounts.health_mint.key();
        protocol.total_patients = 0;
        protocol.total_practitioners = 0;
        protocol.total_pots = 0;
        protocol.total_slashed = 0;
        protocol.total_rewarded = 0;
        protocol.bump = ctx.bumps.protocol_state;
        protocol.treasury = ctx.accounts.treasury.key();

        let seeds = &[b"protocol".as_ref(), &[protocol.bump]];
        let signer = &[&seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.health_mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: protocol_ai,
                },
                signer,
            ),
            initial_supply,
        )?;

        emit!(ProtocolInitialized {
            authority: protocol.authority,
            health_mint: protocol.health_mint,
            initial_supply,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ── Patient Registration ──────────────────

    pub fn register_patient(
        ctx: Context<RegisterPatient>,
        name_hash: [u8; 32],
        onboarding_tokens: u64,
    ) -> Result<()> {
        require!(onboarding_tokens >= MIN_STAKE_AMOUNT, HealthError::InsufficientStake);
        let protocol_ai = ctx.accounts.protocol_state.to_account_info();

        let patient = &mut ctx.accounts.patient_profile;
        patient.wallet = ctx.accounts.patient_wallet.key();
        patient.name_hash = name_hash;
        patient.health_score = BASELINE_HEALTH_SCORE;
        patient.baseline_score = BASELINE_HEALTH_SCORE;
        patient.total_staked = 0;
        patient.total_earned = 0;
        patient.active_pots = 0;
        patient.session_count = 0;
        patient.registered_at = Clock::get()?.unix_timestamp;
        patient.bump = ctx.bumps.patient_profile;

        let protocol = &mut ctx.accounts.protocol_state;
        let bump = protocol.bump;
        let seeds = &[b"protocol".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.patient_token_account.to_account_info(),
                    authority: protocol_ai,
                },
                signer,
            ),
            onboarding_tokens,
        )?;

        protocol.total_patients += 1;

        emit!(PatientRegistered {
            patient: patient.wallet,
            onboarding_tokens,
            timestamp: patient.registered_at,
        });

        Ok(())
    }

    // ── Practitioner Registration ─────────────

    pub fn register_practitioner(
        ctx: Context<RegisterPractitioner>,
        name_hash: [u8; 32],
        specialization: Specialization,
        onboarding_tokens: u64,
    ) -> Result<()> {
        let protocol_ai = ctx.accounts.protocol_state.to_account_info();

        let prac = &mut ctx.accounts.practitioner_profile;
        prac.wallet = ctx.accounts.practitioner_wallet.key();
        prac.name_hash = name_hash;
        prac.specialization = specialization;
        prac.reputation_score = 50;
        prac.total_staked = 0;
        prac.total_earned = 0;
        prac.total_slashed = 0;
        prac.active_pots = 0;
        prac.completed_sessions = 0;
        prac.positive_outcomes = 0;
        prac.negative_outcomes = 0;
        prac.registered_at = Clock::get()?.unix_timestamp;
        prac.bump = ctx.bumps.practitioner_profile;

        let protocol = &mut ctx.accounts.protocol_state;
        let bump = protocol.bump;
        let seeds = &[b"protocol".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.practitioner_token_account.to_account_info(),
                    authority: protocol_ai,
                },
                signer,
            ),
            onboarding_tokens,
        )?;

        protocol.total_practitioners += 1;

        emit!(PractitionerRegistered {
            practitioner: prac.wallet,
            specialization: prac.specialization.clone(),
            onboarding_tokens,
            timestamp: prac.registered_at,
        });

        Ok(())
    }

    // ── Stake Pot (Patient Opens) ─────────────────────────────
    // MODIFIED: Patient opens the pot. Doctor is just a Public Key.
    pub fn open_stake_pot(
        ctx: Context<OpenStakePot>,
        patient_stake: u64,
        treatment_duration_days: u16,
    ) -> Result<()> {
        require!(patient_stake >= MIN_STAKE_AMOUNT, HealthError::InsufficientStake);
        require!(treatment_duration_days > 0, HealthError::InvalidDuration);

        let clock = Clock::get()?;
        let pot = &mut ctx.accounts.stake_pot;

        pot.patient = ctx.accounts.patient_wallet.key();
        pot.practitioner = ctx.accounts.practitioner_wallet.key();
        
        // Initially, only patient stakes
        pot.patient_staked = patient_stake;
        pot.practitioner_staked = 0; 
        pot.total_amount = patient_stake;
        
        // Patient owns 100% initially
        pot.patient_share_bps = 10000;
        pot.practitioner_share_bps = 0;
        
        pot.opened_at = clock.unix_timestamp;
        pot.expires_at = clock.unix_timestamp + (treatment_duration_days as i64 * 86400);
        pot.baseline_health_score = ctx.accounts.patient_profile.health_score;
        pot.current_health_score = ctx.accounts.patient_profile.health_score;
        pot.session_count = 0;
        pot.status = PotStatus::Active;
        pot.bump = ctx.bumps.stake_pot;

        // Transfer patient stake to pot vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.patient_token_account.to_account_info(),
                    to: ctx.accounts.pot_vault.to_account_info(),
                    authority: ctx.accounts.patient_wallet.to_account_info(),
                },
            ),
            patient_stake,
        )?;

        // Update patient profile
        ctx.accounts.patient_profile.active_pots += 1;
        ctx.accounts.patient_profile.total_staked += patient_stake;
        
        // NOTE: We do NOT update practitioner profile here because they haven't joined yet.
        ctx.accounts.protocol_state.total_pots += 1;

        emit!(StakePotOpened {
            pot: pot.key(),
            patient: pot.patient,
            practitioner: pot.practitioner,
            patient_stake,
            practitioner_stake: 0, // 0 initially
            total: pot.total_amount,
            baseline_score: pot.baseline_health_score,
            expires_at: pot.expires_at,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── NEW: Join Pot (Practitioner Joins) ───────────────────────────
    // Practitioner sees the pot and decides to join by staking.
    pub fn join_pot(
        ctx: Context<JoinPot>,
        practitioner_stake: u64,
    ) -> Result<()> {
        require!(practitioner_stake >= MIN_STAKE_AMOUNT, HealthError::InsufficientStake);
        
        let pot = &mut ctx.accounts.stake_pot;
        // Ensure the person joining is the intended practitioner
        require!(ctx.accounts.practitioner_wallet.key() == pot.practitioner, HealthError::Unauthorized);

        // Transfer practitioner stake
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.practitioner_token_account.to_account_info(),
                    to: ctx.accounts.pot_vault.to_account_info(),
                    authority: ctx.accounts.practitioner_wallet.to_account_info(),
                },
            ),
            practitioner_stake,
        )?;

        // Update Pot
        pot.practitioner_staked = practitioner_stake;
        pot.total_amount += practitioner_stake;
        
        // Reset shares to 50/50 (or you can add logic to calculate based on ratio)
        pot.patient_share_bps = 5000;
        pot.practitioner_share_bps = 5000;

        // Update Practitioner Profile
        ctx.accounts.practitioner_profile.active_pots += 1;
        ctx.accounts.practitioner_profile.total_staked += practitioner_stake;

        Ok(())
    }

    // ── Session Recording ─────────────────────

    pub fn record_session(
        ctx: Context<RecordSession>,
        new_health_score: u8,
        session_notes_hash: [u8; 32],
        treatment_type: TreatmentType,
    ) -> Result<()> {
        require!(new_health_score <= MAX_HEALTH_SCORE, HealthError::InvalidHealthScore);
        require!(ctx.accounts.stake_pot.status == PotStatus::Active, HealthError::PotNotActive);

        let clock = Clock::get()?;
        let pot = &mut ctx.accounts.stake_pot;
        let patient = &mut ctx.accounts.patient_profile;
        let prac = &mut ctx.accounts.practitioner_profile;

        let old_score = pot.current_health_score;
        let session_id = pot.session_count;

        let session = &mut ctx.accounts.session_record;
        session.pot = pot.key();
        session.patient = patient.wallet;
        session.practitioner = prac.wallet;
        session.session_number = session_id;
        session.health_score_before = old_score;
        session.health_score_after = new_health_score;
        session.notes_hash = session_notes_hash;
        session.treatment_type = treatment_type.clone();
        session.recorded_at = clock.unix_timestamp;
        session.bump = ctx.bumps.session_record;

        let (patient_share, prac_share, slash_amount) =
            calculate_shares(old_score, new_health_score, pot.patient_staked, pot.practitioner_staked)?;

        pot.current_health_score = new_health_score;
        pot.patient_share_bps = patient_share;
        pot.practitioner_share_bps = prac_share;
        pot.session_count += 1;

        patient.health_score = new_health_score;
        patient.session_count += 1;

        prac.completed_sessions += 1;
        if new_health_score > old_score {
            prac.positive_outcomes += 1;
            prac.reputation_score = prac.reputation_score.saturating_add(2).min(100);
        } else if new_health_score < old_score {
            prac.negative_outcomes += 1;
            prac.reputation_score = prac.reputation_score.saturating_sub(5);
            ctx.accounts.protocol_state.total_slashed += slash_amount;
            prac.total_slashed += slash_amount;
        }

        emit!(SessionRecorded {
            pot: pot.key(),
            session_number: session_id,
            health_score_before: old_score,
            health_score_after: new_health_score,
            treatment_type,
            slash_amount,
            patient_share_bps: patient_share,
            practitioner_share_bps: prac_share,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── Settle Pot ────────────────────────────

    pub fn settle_pot(ctx: Context<SettlePot>) -> Result<()> {
        let clock = Clock::get()?;
        let pot = &mut ctx.accounts.stake_pot;

        require!(pot.status == PotStatus::Active, HealthError::PotNotActive);

        let expired = clock.unix_timestamp >= pot.expires_at;
        require!(expired || pot.session_count > 0, HealthError::PotNotSettleable);

        let total = pot.total_amount;
        let patient_amount = (total as u128 * pot.patient_share_bps as u128 / 10000) as u64;
        let practitioner_amount = total - patient_amount;

        pot.status = PotStatus::Settled;

        let pot_key = pot.key();
        let bump = pot.bump;
        let seeds = &[POT_SEED, pot_key.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        if patient_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pot_vault.to_account_info(),
                        to: ctx.accounts.patient_token_account.to_account_info(),
                        authority: pot.to_account_info(),
                    },
                    signer,
                ),
                patient_amount,
            )?;
        }

        if practitioner_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pot_vault.to_account_info(),
                        to: ctx.accounts.practitioner_token_account.to_account_info(),
                        authority: pot.to_account_info(),
                    },
                    signer,
                ),
                practitioner_amount,
            )?;
        }

        ctx.accounts.patient_profile.active_pots = ctx.accounts.patient_profile.active_pots.saturating_sub(1);
        ctx.accounts.patient_profile.total_earned += patient_amount;
        ctx.accounts.practitioner_profile.active_pots = ctx.accounts.practitioner_profile.active_pots.saturating_sub(1);
        ctx.accounts.practitioner_profile.total_earned += practitioner_amount;
        ctx.accounts.protocol_state.total_rewarded += practitioner_amount;

        emit!(PotSettled {
            pot: pot.key(),
            patient: pot.patient,
            practitioner: pot.practitioner,
            patient_payout: patient_amount,
            practitioner_payout: practitioner_amount,
            final_health_score: pot.current_health_score,
            baseline_score: pot.baseline_health_score,
            sessions: pot.session_count,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── Dispute / Slash ───────────────────────

    pub fn raise_dispute(
        ctx: Context<RaiseDispute>,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let pot = &mut ctx.accounts.stake_pot;
        require!(pot.status == PotStatus::Active, HealthError::PotNotActive);
        require!(ctx.accounts.patient_wallet.key() == pot.patient, HealthError::Unauthorized);

        pot.status = PotStatus::Disputed;

        emit!(DisputeRaised {
            pot: pot.key(),
            patient: pot.patient,
            practitioner: pot.practitioner,
            reason_hash,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        favor_patient: bool,
        slash_percentage: u8,
    ) -> Result<()> {
        require!(slash_percentage <= 100, HealthError::InvalidSlashPercentage);
        let pot = &mut ctx.accounts.stake_pot;
        require!(pot.status == PotStatus::Disputed, HealthError::PotNotDisputed);

        if favor_patient {
            let slash_bps = slash_percentage as u64 * 100;
            let prac_slash = pot.practitioner_staked * slash_bps / 10000;
            pot.patient_share_bps = (pot.patient_share_bps + slash_bps as u16).min(10000);
            pot.practitioner_share_bps = 10000u16.saturating_sub(pot.patient_share_bps);
            ctx.accounts.protocol_state.total_slashed += prac_slash;
            ctx.accounts.practitioner_profile.reputation_score =
                ctx.accounts.practitioner_profile.reputation_score.saturating_sub(10);
        }

        pot.status = PotStatus::Active;

        emit!(DisputeResolved {
            pot: pot.key(),
            favor_patient,
            slash_percentage,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ── Health Oracle Update ──────────────────

    pub fn oracle_update_health(
        ctx: Context<OracleUpdateHealth>,
        verified_score: u8,
        data_source_hash: [u8; 32],
    ) -> Result<()> {
        require!(verified_score <= MAX_HEALTH_SCORE, HealthError::InvalidHealthScore);
        let patient = &mut ctx.accounts.patient_profile;
        let old_score = patient.health_score;
        patient.health_score = verified_score;

        emit!(OracleHealthUpdate {
            patient: patient.wallet,
            old_score,
            new_score: verified_score,
            data_source_hash,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// ─────────────────────────────────────────────
//  Share Calculation Logic
// ─────────────────────────────────────────────

pub fn calculate_shares(
    old_score: u8,
    new_score: u8,
    patient_staked: u64,
    practitioner_staked: u64,
) -> Result<(u16, u16, u64)> {
    let total = patient_staked + practitioner_staked;
    let mut slash_amount: u64 = 0;

    let (patient_bps, prac_bps) = if new_score >= old_score {
        let improvement = (new_score - old_score) as u64;
        let bonus_bps = (improvement * REWARD_RATE_BPS).min(3000);
        let prac_share = (5000 + bonus_bps).min(8000) as u16;
        let patient_share = 10000u16 - prac_share;
        (patient_share, prac_share)
    } else {
        let decline = (old_score - new_score) as u64;
        let slash_bps = (decline * SLASH_RATE_BPS).min(5000);
        slash_amount = practitioner_staked * slash_bps / 10000;
        let patient_share = (5000 + slash_bps).min(9000) as u16;
        let prac_share = 10000u16 - patient_share;
        (patient_share, prac_share)
    };

    Ok((patient_bps, prac_bps, slash_amount))
}

// ─────────────────────────────────────────────
//  Account Contexts
// ─────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        init,
        payer = authority,
        mint::decimals = HEALTH_TOKEN_DECIMALS,
        mint::authority = protocol_state,
    )]
    pub health_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = health_mint,
        token::authority = protocol_state,
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterPatient<'info> {
    #[account(
        init,
        payer = patient_wallet,
        space = 8 + PatientProfile::INIT_SPACE,
        seeds = [PATIENT_SEED, patient_wallet.key().as_ref()],
        bump
    )]
    pub patient_profile: Account<'info, PatientProfile>,

    #[account(
        init_if_needed,
        payer = patient_wallet,
        associated_token::mint = health_mint,
        associated_token::authority = patient_wallet,
    )]
    pub patient_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    pub health_mint: Account<'info, Mint>,

    #[account(mut)]
    pub patient_wallet: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>, 
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterPractitioner<'info> {
    #[account(
        init,
        payer = practitioner_wallet,
        space = 8 + PractitionerProfile::INIT_SPACE,
        seeds = [PRACTITIONER_SEED, practitioner_wallet.key().as_ref()],
        bump
    )]
    pub practitioner_profile: Account<'info, PractitionerProfile>,

    #[account(
        init_if_needed,
        payer = practitioner_wallet,
        associated_token::mint = health_mint,
        associated_token::authority = practitioner_wallet,
    )]
    pub practitioner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    pub health_mint: Account<'info, Mint>,

    #[account(mut)]
    pub practitioner_wallet: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>, 
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ── MODIFIED: OpenStakePot ───────────────────────────────
#[derive(Accounts)]
pub struct OpenStakePot<'info> {
    #[account(
        init,
        payer = patient_wallet,
        space = 8 + StakePot::INIT_SPACE,
        seeds = [
            POT_SEED,
            patient_wallet.key().as_ref(),
            practitioner_wallet.key().as_ref()
        ],
        bump
    )]
    pub stake_pot: Account<'info, StakePot>,

    #[account(
        init,
        payer = patient_wallet,
        token::mint = health_mint,
        token::authority = stake_pot,
    )]
    pub pot_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [PATIENT_SEED, patient_wallet.key().as_ref()],
        bump = patient_profile.bump,
    )]
    pub patient_profile: Account<'info, PatientProfile>,

    // REMOVED: practitioner_profile (not needed yet)
    // REMOVED: practitioner_token_account

    #[account(mut)]
    pub patient_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    pub health_mint: Account<'info, Mint>,

    #[account(mut)]
    pub patient_wallet: Signer<'info>,

    /// CHECK: Practitioner wallet just needs to be passed in as a pubkey for the PDA seed.
    /// They do not sign this transaction.
    #[account(mut)]
    pub practitioner_wallet: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ── NEW: JoinPot Context ─────────────────────────────────────────
#[derive(Accounts)]
pub struct JoinPot<'info> {
    #[account(
        mut,
        seeds = [
            POT_SEED,
            stake_pot.patient.as_ref(),
            stake_pot.practitioner.as_ref()
        ],
        bump = stake_pot.bump,
    )]
    pub stake_pot: Account<'info, StakePot>,

    #[account(mut)]
    pub pot_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [PRACTITIONER_SEED, practitioner_wallet.key().as_ref()],
        bump = practitioner_profile.bump
    )]
    pub practitioner_profile: Account<'info, PractitionerProfile>,

    #[account(mut)]
    pub practitioner_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub practitioner_wallet: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(new_health_score: u8, session_notes_hash: [u8; 32], treatment_type: TreatmentType)]
pub struct RecordSession<'info> {
    #[account(
        init,
        payer = practitioner_wallet,
        space = 8 + SessionRecord::INIT_SPACE,
        seeds = [
            SESSION_SEED,
            stake_pot.key().as_ref(),
            &[stake_pot.session_count]
        ],
        bump
    )]
    pub session_record: Account<'info, SessionRecord>,

    #[account(
        mut,
        seeds = [
            POT_SEED,
            patient_profile.wallet.as_ref(),
            practitioner_wallet.key().as_ref()
        ],
        bump = stake_pot.bump,
        constraint = stake_pot.practitioner == practitioner_wallet.key(),
    )]
    pub stake_pot: Account<'info, StakePot>,

    #[account(
        mut,
        seeds = [PATIENT_SEED, stake_pot.patient.as_ref()],
        bump = patient_profile.bump,
    )]
    pub patient_profile: Account<'info, PatientProfile>,

    #[account(
        mut,
        seeds = [PRACTITIONER_SEED, practitioner_wallet.key().as_ref()],
        bump = practitioner_profile.bump,
    )]
    pub practitioner_profile: Account<'info, PractitionerProfile>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut)]
    pub practitioner_wallet: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SettlePot<'info> {
    #[account(
        mut,
        seeds = [
            POT_SEED,
            patient_profile.wallet.as_ref(),
            practitioner_profile.wallet.as_ref()
        ],
        bump = stake_pot.bump,
    )]
    pub stake_pot: Account<'info, StakePot>,

    #[account(mut)]
    pub pot_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [PATIENT_SEED, patient_profile.wallet.as_ref()],
        bump = patient_profile.bump,
    )]
    pub patient_profile: Account<'info, PatientProfile>,

    #[account(
        mut,
        seeds = [PRACTITIONER_SEED, practitioner_profile.wallet.as_ref()],
        bump = practitioner_profile.bump,
    )]
    pub practitioner_profile: Account<'info, PractitionerProfile>,

    #[account(mut)]
    pub patient_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub practitioner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        mut,
        seeds = [
            POT_SEED,
            patient_wallet.key().as_ref(),
            stake_pot.practitioner.as_ref()
        ],
        bump = stake_pot.bump,
    )]
    pub stake_pot: Account<'info, StakePot>,

    pub patient_wallet: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [
            POT_SEED,
            stake_pot.patient.as_ref(),
            stake_pot.practitioner.as_ref()
        ],
        bump = stake_pot.bump,
    )]
    pub stake_pot: Account<'info, StakePot>,

    #[account(
        mut,
        seeds = [PRACTITIONER_SEED, stake_pot.practitioner.as_ref()],
        bump = practitioner_profile.bump,
    )]
    pub practitioner_profile: Account<'info, PractitionerProfile>,

    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(constraint = oracle.key() == protocol_state.authority @ HealthError::Unauthorized)]
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct OracleUpdateHealth<'info> {
    #[account(
        mut,
        seeds = [PATIENT_SEED, patient_profile.wallet.as_ref()],
        bump = patient_profile.bump,
    )]
    pub patient_profile: Account<'info, PatientProfile>,

    #[account(
        seeds = [b"protocol"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(constraint = oracle.key() == protocol_state.authority @ HealthError::Unauthorized)]
    pub oracle: Signer<'info>,
}

// ─────────────────────────────────────────────
//  State Accounts
// ─────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub health_mint: Pubkey,
    pub treasury: Pubkey,
    pub total_patients: u64,
    pub total_practitioners: u64,
    pub total_pots: u64,
    pub total_slashed: u64,
    pub total_rewarded: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PatientProfile {
    pub wallet: Pubkey,
    pub name_hash: [u8; 32],
    pub health_score: u8,
    pub baseline_score: u8,
    pub total_staked: u64,
    pub total_earned: u64,
    pub active_pots: u8,
    pub session_count: u32,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PractitionerProfile {
    pub wallet: Pubkey,
    pub name_hash: [u8; 32],
    pub specialization: Specialization,
    pub reputation_score: u8,
    pub total_staked: u64,
    pub total_earned: u64,
    pub total_slashed: u64,
    pub active_pots: u8,
    pub completed_sessions: u32,
    pub positive_outcomes: u32,
    pub negative_outcomes: u32,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakePot {
    pub patient: Pubkey,
    pub practitioner: Pubkey,
    pub patient_staked: u64,
    pub practitioner_staked: u64,
    pub total_amount: u64,
    pub patient_share_bps: u16,
    pub practitioner_share_bps: u16,
    pub opened_at: i64,
    pub expires_at: i64,
    pub baseline_health_score: u8,
    pub current_health_score: u8,
    pub session_count: u8,
    pub status: PotStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SessionRecord {
    pub pot: Pubkey,
    pub patient: Pubkey,
    pub practitioner: Pubkey,
    pub session_number: u8,
    pub health_score_before: u8,
    pub health_score_after: u8,
    pub notes_hash: [u8; 32],
    pub treatment_type: TreatmentType,
    pub recorded_at: i64,
    pub bump: u8,
}

// ─────────────────────────────────────────────
//  Enums
// ─────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum PotStatus {
    Active,
    Settled,
    Disputed,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub enum Specialization {
    PrimaryCare,
    Cardiology,
    Nutrition,
    MentalHealth,
    Oncology,
    Orthopedics,
    Dermatology,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub enum TreatmentType {
    Consultation,
    Prescription,
    Procedure,
    LifestyleChange,
    Rehabilitation,
    Monitoring,
    Other,
}

// ─────────────────────────────────────────────
//  Events
// ─────────────────────────────────────────────

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub health_mint: Pubkey,
    pub initial_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct PatientRegistered {
    pub patient: Pubkey,
    pub onboarding_tokens: u64,
    pub timestamp: i64,
}

#[event]
pub struct PractitionerRegistered {
    pub practitioner: Pubkey,
    pub specialization: Specialization,
    pub onboarding_tokens: u64,
    pub timestamp: i64,
}

#[event]
pub struct StakePotOpened {
    pub pot: Pubkey,
    pub patient: Pubkey,
    pub practitioner: Pubkey,
    pub patient_stake: u64,
    pub practitioner_stake: u64,
    pub total: u64,
    pub baseline_score: u8,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct SessionRecorded {
    pub pot: Pubkey,
    pub session_number: u8,
    pub health_score_before: u8,
    pub health_score_after: u8,
    pub treatment_type: TreatmentType,
    pub slash_amount: u64,
    pub patient_share_bps: u16,
    pub practitioner_share_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct PotSettled {
    pub pot: Pubkey,
    pub patient: Pubkey,
    pub practitioner: Pubkey,
    pub patient_payout: u64,
    pub practitioner_payout: u64,
    pub final_health_score: u8,
    pub baseline_score: u8,
    pub sessions: u8,
    pub timestamp: i64,
}

#[event]
pub struct DisputeRaised {
    pub pot: Pubkey,
    pub patient: Pubkey,
    pub practitioner: Pubkey,
    pub reason_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub pot: Pubkey,
    pub favor_patient: bool,
    pub slash_percentage: u8,
    pub timestamp: i64,
}

#[event]
pub struct OracleHealthUpdate {
    pub patient: Pubkey,
    pub old_score: u8,
    pub new_score: u8,
    pub data_source_hash: [u8; 32],
    pub timestamp: i64,
}

// ─────────────────────────────────────────────
//  Errors
// ─────────────────────────────────────────────

#[error_code]
pub enum HealthError {
    #[msg("Stake amount below minimum required")]
    InsufficientStake,
    #[msg("Health score must be between 0 and 100")]
    InvalidHealthScore,
    #[msg("Treatment duration must be at least 1 day")]
    InvalidDuration,
    #[msg("Stake pot is not active")]
    PotNotActive,
    #[msg("Stake pot is not in disputed state")]
    PotNotDisputed,
    #[msg("Pot cannot be settled yet")]
    PotNotSettleable,
    #[msg("Unauthorized: caller is not permitted")]
    Unauthorized,
    #[msg("Slash percentage must be 0–100")]
    InvalidSlashPercentage,
    #[msg("Arithmetic overflow")]
    Overflow,
}