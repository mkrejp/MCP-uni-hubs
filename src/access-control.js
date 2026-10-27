export class AccessControlPlugin {
  constructor({ datastore, logger = null } = {}) {
    this.datastore = datastore;
    this.logger = logger;
  }

  async getUser(userId) {
    if (!this.datastore) {
      return null;
    }
    return this.datastore.read('users', userId);
  }

  async getGroup(groupId) {
    if (!this.datastore) {
      return null;
    }
    return this.datastore.read('groups', groupId);
  }

  async getOrganization(orgId) {
    if (!this.datastore) {
      return null;
    }
    return this.datastore.read('organizations', orgId);
  }

  async listGroupsForUser(userId) {
    const user = await this.getUser(userId);
    if (!user || !Array.isArray(user.groupIds)) {
      return [];
    }

    const groups = [];
    for (const groupId of user.groupIds) {
      const group = await this.getGroup(groupId);
      if (group) {
        groups.push(group);
      }
    }

    return groups;
  }

  async listAclEntries({ subjectType = null, subjectId = null, resourceType = null, resourceId = null, organizationId = null } = {}) {
    if (!this.datastore) {
      return [];
    }

    const entries = await this.datastore.list('acls');
    const items = [];

    for (const entryId of entries) {
      const acl = await this.datastore.read('acls', entryId);
      if (!acl) {
        continue;
      }

      const matches = (!subjectType || acl.subjectType === subjectType)
        && (!subjectId || acl.subjectId === subjectId)
        && (!resourceType || acl.resourceType === resourceType || acl.resourceType === '*')
        && (!resourceId || acl.resourceId === resourceId)
        && (!organizationId || acl.organizationId === organizationId);

      if (matches) {
        items.push(acl);
      }
    }

    return items;
  }

  async canAccess(userId, resourceId, action, resourceType = 'plugin') {
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    const subjectMatches = [];
    subjectMatches.push({ type: 'user', id: userId, organizationId: user.organizationId });

    const groups = await this.listGroupsForUser(userId);
    for (const group of groups) {
      subjectMatches.push({ type: 'group', id: group.id, organizationId: group.organizationId ?? user.organizationId });
    }

    for (const subject of subjectMatches) {
      const aclEntries = await this.listAclEntries({
        subjectType: subject.type,
        subjectId: subject.id,
        resourceType,
        resourceId,
        organizationId: subject.organizationId,
      });

      for (const entry of aclEntries) {
        if (entry.action === action || entry.action === '*') {
          return entry.effect === 'allow';
        }
      }

      const orgEntries = await this.listAclEntries({
        subjectType: subject.type,
        subjectId: subject.id,
        resourceType,
        resourceId: '*',
        organizationId: subject.organizationId,
      });

      for (const entry of orgEntries) {
        if (entry.action === action || entry.action === '*') {
          return entry.effect === 'allow';
        }
      }
    }

    return false;
  }
}

export function registerAccessControl(appContext = {}) {
  return new AccessControlPlugin({ datastore: appContext.datastore, logger: appContext.logger });
}
