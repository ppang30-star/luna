import { createClient } from './client'

/**
 * Initializes the managers table in Supabase by attempting to insert a test record
 * This works because Supabase will auto-create the table if it doesn't exist
 */
export async function initializeManagersTable(): Promise<boolean> {
  try {
    const supabase = createClient()

    // First, check if table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('managers')
      .select('id, name')
      .limit(1)

    // If select succeeded, table exists
    if (!checkError) {
      console.log('[v0] Managers table already exists')
      return true
    }

    // If we get here, table doesn't exist. Try to create it by inserting
    console.log('[v0] Managers table does not exist, attempting to create via insert...')
    
    const tempId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const { error: insertError } = await supabase
      .from('managers')
      .insert({
        id: tempId,
        name: `__init_temp_${tempId}__`,
        password: 'temp_init_password',
        role: 'temp'
      })
      .select()

    if (insertError) {
      console.error('[v0] Failed to create managers table:', insertError.message)
      return false
    }

    // Successfully inserted, now delete the temp record
    console.log('[v0] Table created, cleaning up temporary data...')
    try {
      await supabase
        .from('managers')
        .delete()
        .eq('id', tempId)
    } catch (deleteErr) {
      console.warn('[v0] Could not delete temp record:', deleteErr)
      // Table still exists even if delete failed
    }

    console.log('[v0] Managers table initialized successfully')
    return true
  } catch (err) {
    console.error('[v0] Error initializing managers table:', err)
    return false
  }
}

/**
 * Initializes the price_adjustment_logs table
 */
export async function initializePriceAdjustmentLogsTable(): Promise<boolean> {
  try {
    const supabase = createClient()

    // Check if table exists
    const { error: checkError } = await supabase
      .from('price_adjustment_logs')
      .select('id')
      .limit(1)

    if (!checkError) {
      console.log('[v0] Price adjustment logs table already exists')
      return true
    }

    // Try to create via insert
    console.log('[v0] Price adjustment logs table does not exist, attempting to create...')
    
    const tempId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const { error: insertError } = await supabase
      .from('price_adjustment_logs')
      .insert({
        id: tempId,
        menu_item_id: 'temp',
        menu_name: 'temp',
        original_price: 0,
        adjusted_price: 0,
        price_change: 0,
        manager_name: 'temp',
        adjustment_date: new Date().toISOString()
      })
      .select()

    if (insertError) {
      console.error('[v0] Failed to create price_adjustment_logs table:', insertError.message)
      return false
    }

    // Delete temp record
    try {
      await supabase
        .from('price_adjustment_logs')
        .delete()
        .eq('id', tempId)
    } catch (deleteErr) {
      console.warn('[v0] Could not delete temp record:', deleteErr)
    }

    console.log('[v0] Price adjustment logs table initialized successfully')
    return true
  } catch (err) {
    console.error('[v0] Error initializing price_adjustment_logs table:', err)
    return false
  }
}

/**
 * Initialize all required tables
 */
export async function initializeAllTables(): Promise<boolean> {
  try {
    console.log('[v0] Starting table initialization...')
    const managersReady = await initializeManagersTable()
    const logsReady = await initializePriceAdjustmentLogsTable()
    
    if (managersReady && logsReady) {
      console.log('[v0] All tables initialized successfully')
      return true
    }
    
    console.warn('[v0] Some tables failed to initialize, but will attempt to continue')
    return managersReady // Return managers table status as it's the critical one
  } catch (err) {
    console.error('[v0] Error initializing all tables:', err)
    return false
  }
}
