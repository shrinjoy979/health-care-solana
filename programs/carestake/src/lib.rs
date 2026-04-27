use anchor_lang::prelude::*;

declare_id!("EjT1hTKBsGouxAfJJJjjH4FoMUda9bBYyGPuu3tknDVx");

#[program]
pub mod carestake {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
