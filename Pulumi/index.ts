import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const projectName = "airtek-demo";
const environment = "production";


// configuration for the VPC
const vpc = new aws.ec2.Vpc(`${projectName}-vpc`, {
cidrBlock: "10.0.0.0/16",
enableDnsSupport: true,
enableDnsHostnames: true,
tags: { Name: `${projectName}-vpc`, Environment: environment, Project: projectName },
});

//  Subnets in two diffferent AZ for availability
const publicSubnet1 = new aws.ec2.Subnet(`${projectName}-public-subnet-1`, {
vpcId: vpc.id,
cidrBlock: "10.0.1.0/24",
mapPublicIpOnLaunch: true,
availabilityZone: "us-east-1a",
tags: { Name: `${projectName}-public-1`, Environment: environment, Project: projectName },
});
const publicSubnet2 = new aws.ec2.Subnet(`${projectName}-public-subnet-2`, {
vpcId: vpc.id,
cidrBlock: "10.0.2.0/24",
mapPublicIpOnLaunch: true,
availabilityZone: "us-east-1b",
tags: { Name: `${projectName}-public-2`, Environment: environment, Project: projectName },
});
const privateSubnet1 = new aws.ec2.Subnet(`${projectName}-private-subnet-1`, {
vpcId: vpc.id,
cidrBlock: "10.0.3.0/24",
mapPublicIpOnLaunch: false,
availabilityZone: "us-east-1a",
tags: { Name: `${projectName}-private-1`, Environment: environment, Project: projectName },
});
const privateSubnet2 = new aws.ec2.Subnet(`${projectName}-private-subnet-2`, {
vpcId: vpc.id,
cidrBlock: "10.0.4.0/24",
mapPublicIpOnLaunch: false,
availabilityZone: "us-east-1b",
tags: { Name: `${projectName}-private-2`, Environment: environment, Project: projectName },
});

// Internet Gateway and Public route Table
const internetGateway = new aws.ec2.InternetGateway(`${projectName}-igw`, {
vpcId: vpc.id,
tags: { Name: `${projectName}-igw`, Environment: environment, Project: projectName },
});
const publicRouteTable = new aws.ec2.RouteTable(`${projectName}-public-rt`, {
vpcId: vpc.id,
routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: internetGateway.id }],
tags: { Name: `${projectName}-public-rt`, Environment: environment, Project: projectName },
});
new aws.ec2.RouteTableAssociation(`${projectName}-rta-1`, {
routeTableId: publicRouteTable.id,
subnetId: publicSubnet1.id,
});
new aws.ec2.RouteTableAssociation(`${projectName}-rta-2`, {
routeTableId: publicRouteTable.id,
subnetId: publicSubnet2.id,
});

// NAT Gateway and Private Route Table
const natGateway = new aws.ec2.NatGateway(`${projectName}-nat-gw`, {
subnetId: publicSubnet1.id,
allocationId: new aws.ec2.Eip(`${projectName}-eip`, {}).id,
tags: { Name: `${projectName}-nat-gw`, Environment: environment, Project: projectName },
});
const privateRouteTable = new aws.ec2.RouteTable(`${projectName}-private-rt`, {
vpcId: vpc.id,
routes: [{ cidrBlock: "0.0.0.0/0", natGatewayId: natGateway.id }],
tags: { Name: `${projectName}-private-rt`, Environment: environment, Project: projectName },
});
new aws.ec2.RouteTableAssociation(`${projectName}-private-rta-1`, {
routeTableId: privateRouteTable.id,
subnetId: privateSubnet1.id,
});
new aws.ec2.RouteTableAssociation(`${projectName}-private-rta-2`, {
routeTableId: privateRouteTable.id,
subnetId: privateSubnet2.id,
});

// Security Groups
const webSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-web-sg`, {
vpcId: vpc.id,
ingress: [
{ protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
],
egress: [{ protocol: "tcp", fromPort: 5000, toPort: 5000, cidrBlocks: ["0.0.0.0/0"] }],
tags: { Name: `${projectName}-web-sg`, Environment: environment, Project: projectName },
});
const apiSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-api-sg`, {
vpcId: vpc.id,
ingress: [
{ protocol: "tcp", fromPort: 5000, toPort: 5000, securityGroups: [webSecurityGroup.id] },
],
egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
tags: { Name: `${projectName}-api-sg`, Environment: environment, Project: projectName },
});

// Load Balancer for  the Web UI
const loadBalancer = new aws.lb.LoadBalancer(`${projectName}-alb`, {
internal: false,
securityGroups: [webSecurityGroup.id],
subnets: [publicSubnet1.id, publicSubnet2.id],
tags: { Name: `${projectName}-alb`, Environment: environment, Project: projectName },
});
const webTargetGroup = new aws.lb.TargetGroup(`${projectName}-web-tg`, {
vpcId: vpc.id,
port: 80,
protocol: "HTTP",
targetType: "ip",
tags: { Name: `${projectName}-web-tg`, Environment: environment, Project: projectName },
});
new aws.lb.Listener(`${projectName}-listener`, {
loadBalancerArn: loadBalancer.arn,
port: 80,
protocol: "HTTP",
defaultActions: [{ type: "forward", targetGroupArn: webTargetGroup.arn }],
});


// ECS Cluster
const ecsCluster = new aws.ecs.Cluster(`${projectName}-cluster`, {
tags: { Name: `${projectName}-cluster`, Environment: environment, Project: projectName },
});
    
// ECS Task Definitions
const ecsRole = new aws.iam.Role(`${projectName}-ecs-role`, {
assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ecs-tasks.amazonaws.com" }),
tags: { Name: `${projectName}-ecs-role`, Environment: environment, Project: projectName },
});
new aws.iam.RolePolicyAttachment(`${projectName}-ecs-policy`, {
role: ecsRole.name,
policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});
const webTaskDefinition = new aws.ecs.TaskDefinition(`${projectName}-web-task`, {
family: `${projectName}-web`,
cpu: "256",
memory: "512",
networkMode: "awsvpc",
requiresCompatibilities: ["FARGATE"],
executionRoleArn: ecsRole.arn,
containerDefinitions: JSON.stringify([
{
name: "web",
image: "448049826560.dkr.ecr.us-east-1.amazonaws.com/infraweb:v2",
portMappings: [{ containerPort: 80 }],
healthCheck: {
command: ["CMD-SHELL", "curl -f http://localhost/health || exit 1"],
interval: 30,
timeout: 5,
retries: 3,
startPeriod: 10,
},
},
]),
});
const apiTaskDefinition = new aws.ecs.TaskDefinition(`${projectName}-api-task`, {
family: `${projectName}-api`,
cpu: "256",
memory: "512",
networkMode: "awsvpc",
requiresCompatibilities: ["FARGATE"],
executionRoleArn: ecsRole.arn,

containerDefinitions: JSON.stringify([
{
name: "api",
image: "448049826560.dkr.ecr.us-east-1.amazonaws.com/infraapi:v2",
portMappings: [{ containerPort: 5000 }],
healthCheck: {
command: ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
interval: 30,
timeout: 5,
retries: 3,
startPeriod: 10,
},
},
]),
});

// ECS Services
new aws.ecs.Service(`${projectName}-web-service`, {
cluster: ecsCluster.id,
taskDefinition: webTaskDefinition.arn,
desiredCount: 2,
launchType: "FARGATE",
networkConfiguration: {
subnets: [publicSubnet1.id, publicSubnet2.id],
securityGroups: [webSecurityGroup.id],
},
tags: { Name: `${projectName}-web-service`, Environment: environment, Project: projectName },
});
new aws.ecs.Service(`${projectName}-api-service`, {
cluster: ecsCluster.id,
taskDefinition: apiTaskDefinition.arn,
desiredCount: 2,
launchType: "FARGATE",
networkConfiguration: {
subnets: [privateSubnet1.id, privateSubnet2.id],
securityGroups: [apiSecurityGroup.id],
},
tags: { Name: `${projectName}-api-service`, Environment: environment, Project: projectName },
});


// exports
export const albDnsName = loadBalancer.dnsName;
