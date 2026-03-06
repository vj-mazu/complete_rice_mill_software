const QualityParametersRepository = require('../repositories/QualityParametersRepository');
const ValidationService = require('./ValidationService');
const AuditService = require('./AuditService');
const WorkflowEngine = require('./WorkflowEngine');

class QualityParametersService {
  /**
   * Add quality parameters to a sample entry
   * @param {Object} qualityData - Quality parameters data
   * @param {number} userId - User ID adding the parameters
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Created quality parameters
   */
  async addQualityParameters(qualityData, userId, userRole) {
    try {
      // Validate input data
      const validation = ValidationService.validateQualityParameters(qualityData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Auto-fill reportedBy with current user
      qualityData.reportedByUserId = userId;

      // Create quality parameters
      const quality = await QualityParametersRepository.create(qualityData);

      // Log audit trail
      await AuditService.logCreate(userId, 'quality_parameters', quality.id, quality);

      // Transition workflow to QUALITY_CHECK (from STAFF_ENTRY) — for both 100-gms and full quality saves
      // so that 100-gms entries also appear in Pending (Sample Selection)
      await WorkflowEngine.transitionTo(
        qualityData.sampleEntryId,
        'QUALITY_CHECK',
        userId,
        userRole,
        { qualityParametersId: quality.id }
      );

      return quality;

    } catch (error) {
      console.error('Error adding quality parameters:', error);
      throw error;
    }
  }

  /**
   * Get quality parameters by sample entry ID
   * @param {number} sampleEntryId - Sample entry ID
   * @returns {Promise<Object|null>} Quality parameters or null
   */
  async getQualityParametersBySampleEntry(sampleEntryId) {
    return await QualityParametersRepository.findBySampleEntryId(sampleEntryId);
  }

  /**
   * Update quality parameters
   * @param {number} id - Quality parameters ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated quality parameters or null
   */
  async updateQualityParameters(id, updates, userId, userRole) {
    try {
      // Get current quality parameters
      const current = await QualityParametersRepository.findBySampleEntryId(updates.sampleEntryId);
      if (!current) {
        throw new Error('Quality parameters not found');
      }

      // Validate updates
      const validation = ValidationService.validateQualityParameters(updates);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Update quality parameters
      const updated = await QualityParametersRepository.update(id, updates);

      // Log audit trail
      await AuditService.logUpdate(
        userId,
        'quality_parameters',
        id,
        current,
        updated
      );

      // If upgrading from 100g to full quality (is100Grams=false), transition workflow
      if (!updates.is100Grams && userRole) {
        try {
          await WorkflowEngine.transitionTo(
            updates.sampleEntryId,
            'QUALITY_CHECK',
            userId,
            userRole,
            { qualityParametersId: id }
          );
        } catch (wfErr) {
          // Workflow transition may fail if already at QUALITY_CHECK or beyond — that's ok
          console.log('Workflow transition note:', wfErr.message);
        }
      }

      return updated;

    } catch (error) {
      console.error('Error updating quality parameters:', error);
      throw error;
    }
  }
}

module.exports = new QualityParametersService();
