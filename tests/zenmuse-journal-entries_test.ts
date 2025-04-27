import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "Journal Entries: Create entry successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    const block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('First encrypted journal entry')), 
          types.list([types.ascii('personal'), types.ascii('reflection')])
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectUint(1); // First entry
  }
});

Clarinet.test({
  name: "Journal Entries: Update existing entry",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // First create an entry
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('Initial encrypted entry')), 
          types.list([types.ascii('initial')])
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk().expectUint(1);

    // Then update the entry
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'update-entry', 
        [
          types.uint(1),
          types.buff(Buffer.from('Updated encrypted entry')), 
          types.list([types.ascii('updated'), types.ascii('revised')])
        ], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Journal Entries: Delete entry successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Create an entry first
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('Entry to be deleted')), 
          types.list([types.ascii('temporary')])
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk().expectUint(1);

    // Delete the entry
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'delete-entry', 
        [types.uint(1)], 
        deployer.address
      )
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Journal Entries: Enforce entry limit",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Create 100 entries to hit the limit
    const entries = Array.from({length: 100}, (_, i) => 
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from(`Entry ${i+1}`)), 
          types.list([types.ascii('limit-test')])
        ], 
        deployer.address
      )
    );

    const block = chain.mineBlock(entries);
    // Last entry might partially succeed depending on exact implementation
    const lastEntryResult = block.receipts[99].result;
    
    // Attempt to create 101st entry
    const overLimitBlock = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('Entry beyond limit')), 
          types.list([types.ascii('overflow')])
        ], 
        deployer.address
      )
    ]);

    overLimitBlock.receipts[0].result.expectErr().expectUint(429); // ERR_ENTRY_LIMIT_REACHED
  }
});

Clarinet.test({
  name: "Journal Entries: Unauthorized entry modification fails",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    // Create entry by deployer
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('Private entry')), 
          types.list([types.ascii('secret')])
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk().expectUint(1);

    // Attempt to update from different account
    block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'update-entry', 
        [
          types.uint(1),
          types.buff(Buffer.from('Unauthorized modification')), 
          types.list([types.ascii('hacked')])
        ], 
        wallet1.address
      )
    ]);

    block.receipts[0].result.expectErr().expectUint(404); // ERR_ENTRY_NOT_FOUND
  }
});

Clarinet.test({
  name: "Journal Entries: Retrieve entries with tags",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Create entries with various tags
    let block = chain.mineBlock([
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('Travel log entry 1')), 
          types.list([types.ascii('travel'), types.ascii('adventure')])
        ], 
        deployer.address
      ),
      Tx.contractCall('zenmuse-journal-entries', 'create-entry', 
        [
          types.buff(Buffer.from('Travel log entry 2')), 
          types.list([types.ascii('travel'), types.ascii('europe')])
        ], 
        deployer.address
      )
    ]);

    // Verify entries created
    block.receipts[0].result.expectOk().expectUint(1);
    block.receipts[1].result.expectOk().expectUint(2);

    // Read entries back to verify tags
    const entry1 = chain.callReadOnlyFn(
      'zenmuse-journal-entries', 
      'get-entry', 
      [types.principal(deployer.address), types.uint(1)],
      deployer.address
    );

    entry1.result.expectSome();
  }
});