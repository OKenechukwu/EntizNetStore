import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

// The type of the access group for EntizNetStore
export enum ObjectAccessGroupType {
  SELLER_ONLY = "seller_only",
  ADMIN_ONLY = "admin_only", 
  KYC_REVIEWER = "kyc_reviewer"
}

// The logic user group that can access the object.
export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

// The ACL policy of the object for EntizNetStore security
export interface ObjectAclPolicy {
  owner: string; // User ID who owns the object
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

// Check if the requested permission is allowed based on the granted permission.
function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  // Users granted with read or write permissions can read the object.
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }

  // Only users granted with write permissions can write the object.
  return granted === ObjectPermission.WRITE;
}

// The base class for all access groups.
abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  // Check if the user is a member of the group.
  public abstract hasMember(userId: string): Promise<boolean>;
}

// Seller-only access group - only the specific seller can access
class SellerOnlyAccessGroup extends BaseObjectAccessGroup {
  constructor(sellerId: string) {
    super(ObjectAccessGroupType.SELLER_ONLY, sellerId);
  }

  async hasMember(userId: string): Promise<boolean> {
    return userId === this.id;
  }
}

// Admin-only access group - only admins can access
class AdminOnlyAccessGroup extends BaseObjectAccessGroup {
  constructor() {
    super(ObjectAccessGroupType.ADMIN_ONLY, "admin");
  }

  async hasMember(userId: string): Promise<boolean> {
    // TODO: Implement admin role checking from database
    // For now, return false - will be implemented with admin system
    return false;
  }
}

// KYC reviewer access group - users with KYC review permissions
class KYCReviewerAccessGroup extends BaseObjectAccessGroup {
  constructor() {
    super(ObjectAccessGroupType.KYC_REVIEWER, "kyc_reviewer");
  }

  async hasMember(userId: string): Promise<boolean> {
    // TODO: Implement KYC reviewer role checking from database
    // For now, return false - will be implemented with admin system
    return false;
  }
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    case ObjectAccessGroupType.SELLER_ONLY:
      return new SellerOnlyAccessGroup(group.id);
    case ObjectAccessGroupType.ADMIN_ONLY:
      return new AdminOnlyAccessGroup();
    case ObjectAccessGroupType.KYC_REVIEWER:
      return new KYCReviewerAccessGroup();
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

// Sets the ACL policy to the object metadata.
export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

// Gets the ACL policy from the object metadata.
export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

// Checks if the user can access the object with EntizNetStore security rules
export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  // When this function is called, the acl policy is required.
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  // Public objects are always accessible for read.
  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  // Access control requires the user id.
  if (!userId) {
    return false;
  }

  // The owner of the object can always access it.
  if (aclPolicy.owner === userId) {
    return true;
  }

  // Go through the ACL rules to check if the user has the required permission.
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}