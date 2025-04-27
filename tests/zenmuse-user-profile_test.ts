import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "User Profile: Valid profile creation succeeds",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'create-profile', 
        [
          types.ascii('johndoe'), 
          types.buff(Buffer.from('encrypted-prefs'))
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify profile was created
    const profileInfo = chain.callReadOnlyFn(
      'zenmuse-user-profile', 
      'get-profile-info', 
      [types.principal(deployer.address)],
      deployer.address
    );
    
    profileInfo.result.expectSome();
  }
});

Clarinet.test({
  name: "User Profile: Prevent duplicate username registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // First successful profile creation
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'create-profile', 
        [
          types.ascii('uniqueuser'), 
          types.buff(Buffer.from('encrypted-prefs-1'))
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Attempt to create another profile with same username
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'create-profile', 
        [
          types.ascii('uniqueuser'), 
          types.buff(Buffer.from('encrypted-prefs-2'))
        ], 
        wallet1.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(409); // ERR_PROFILE_EXISTS
  }
});

Clarinet.test({
  name: "User Profile: Profile update by owner succeeds",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // First create a profile
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'create-profile', 
        [
          types.ascii('updateuser'), 
          types.buff(Buffer.from('initial-prefs'))
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Update preferences
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'update-preferences', 
        [types.buff(Buffer.from('updated-prefs'))], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "User Profile: Unauthorized profile modification fails",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Create profile for deployer
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'create-profile', 
        [
          types.ascii('privateuser'), 
          types.buff(Buffer.from('initial-prefs'))
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Attempt update from different account
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'update-preferences', 
        [types.buff(Buffer.from('hacked-prefs'))], 
        wallet1.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(404); // ERR_PROFILE_NOT_FOUND
  }
});

Clarinet.test({
  name: "User Profile: Profile deletion works correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Create profile
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'create-profile', 
        [
          types.ascii('deleteuser'), 
          types.buff(Buffer.from('delete-prefs'))
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Delete profile
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-user-profile', 'delete-profile', [], deployer.address)
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify profile is deleted
    const profileInfo = chain.callReadOnlyFn(
      'zenmuse-user-profile', 
      'get-profile-info', 
      [types.principal(deployer.address)],
      deployer.address
    );
    
    profileInfo.result.expectNone();
  }
});