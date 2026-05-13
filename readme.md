https://github.com/user-attachments/assets/2cfc4467-4627-4586-ba05-4b13a328bc76


# CareStake

CareStake is a decentralized healthcare incentive platform built on Solana using Rust and React.

It aligns incentives between patients and healthcare practitioners through outcome-based staking using $HEALTH tokens.

## Problem

Traditional healthcare systems often suffer from misaligned incentives:
- Patients want better outcomes
- Providers and systems are often rewarded for more treatments and higher costs

CareStake introduces transparent, outcome-driven healthcare incentives using blockchain.

## Solution

- Patients and practitioners both stake $HEALTH tokens
- Practitioners recommend treatments and track patient progress
- Positive outcomes reward practitioners
- Poor outcomes can slash practitioner stakes and return value to patients

## Features

- Solana smart contracts in Rust
- React frontend
- Wallet integration
- Patient & practitioner dashboards
- Outcome-based staking
- Reward and slashing mechanism

## Tech Stack

### Blockchain
- Solana
- Anchor Framework
- Rust

### Frontend
- React
- TypeScript
- Vite

## How It Works

1. Connect wallet
2. Create healthcare agreement
3. Stake $HEALTH tokens
4. Track health progress
5. Rewards/slashing executed based on outcomes


## Local Setup

```bash
git clone https://github.com/shrinjoy979/care-stake-solana.git
cd carestake
npm install
npm run dev
