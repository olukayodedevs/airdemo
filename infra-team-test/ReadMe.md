# Deploying into AWS with Pulumi : A DotNet 5.0 build

In This repo i documented my  approach to deploying a **Web UI** and **API** on **AWS ECS**, leveraging **Pulumi** for IAC. The project was a blend of implementing robust configurations, possible real-world challenge and yes, the ``HTTP 503 errors`` I had to talk about that annoying thing elaborately in this read me.



Based off instructions, the architecture ensures:

- The **API** runs securely in private subnets, accessible only by the Web UI.
- The **Web UI** is exposed through  an **Application Load Balancer (ALB)**.
- Health check endpoints were introduced to stabilize ECS task registration with ALB target groups.

While the process went smoothly at times, there were moments where I had to pause, scratch my head, and wonder, *"What am I missing?!"* These are exactly the types of things we like to iron out before the weekend. or else! (we know how that  goes).

---

##  Tech Stack and Tools Used

- **Pulumi**: For provisioning AWS resources with reusable IaC using Typescript.
- **AWS ECS**: For container orchestration.
- **AWS ALB**: For routing traffic and performing  frequent health checks.
- **CloudWatch**:  For digging deep into logs and metrics.
- **Docker and ECS**: For containerizing services.
- **IAM Roles**: For secure resource access.

---

##  Architecture Overview

### Key Components:

1. **API Service**: 
   - Deployed in private subnets for security.
   - Accessible only by the Web UI.

2. **Web UI**:
   - Deployed in public subnets with ALB routing on port 80.
   - Configured to handle public traffic securely.

3. **ALB**:
   - Routes traffic to ECS tasks.
   - Monitors health via the `/health` endpoint.

---

##  Key Modifications

### Health Check Endpoints

During the initial setup, ECS tasks were failing health checks because the services lacked `/health` endpoints. I quickly addressed this by updating the source code to include proper health endpoints.

- **API Service** (`Startup.cs`): I Added `/health` endpoint to confirm readiness.

_Image placeholder for API `/health` endpoint._

- **Web UI Service** (`Startup.cs`): I also Added `/health` endpoint for Web UI health monitoring.

_Image placeholder for Web UI `/health` endpoint._

---

##  Pulumi Infrastructure Deployment

Pulumi was the IaC tool of choice to provision AWS resources like VPCs, subnets, ECS clusters, and ALB configurations. This ensured a consistent and scalable deployment process.

### Highlights of my Pulumi Configurations:

#### ECS Task Definition:
I added health check configurations to enable seamless registration with the ALB.

_Image placeholder for ECS Task Definition._

#### ALB Target Group:
Defined `/health` as the health check endpoint so as to make sure the HTTP request from ALB always return `Ok 200` which means the  container is healthy

_Image placeholder for ALB Target Group configuration._

#### Security Groups:
Ensured ALB and ECS tasks could communicate securely without any network bottlenecks.

_Image placeholder for Security Group configuration._

---

##  Challenges and Troubleshooting

### Health Check Failures

**Issue**: 
ECS tasks kept failing to register with the ALB.

**Root Cause**:
- Missing `/health` endpoints in the application code.

**Solution**:
- Introduced `/health` endpoints for both the API and Web UI in the respective `Startup.cs` files, and i also added it to the Pulumi script to ensure it is the default health check endpoint for the target group in front of the ALB.
- Configured ALB target groups to point to `/health`.

---

### HTTP 503 Errors

### RecourceInitializationError

---

### HTTP 503 Errors

**Issue**: 
Even after fixing health check failures, the ALB occasionally returned `503 Service Unavailable`. This is the kind of issue that feels minor but keeps you up at night wondering what you missed!

**Analysis**:
- Possible reasons:
  - ECS tasks not becoming "ready" in time.
  - Security group misconfigurations.
  - Load balancer timing mismatches during deregistration.

**Resolutions Attempted**:
1. Verified task readiness through **CloudWatch Logs**.
2. Adjusted `deregistrationDelay` in the ALB target group to ensure tasks have time to stabilize.
3. Ran connectivity tests using `curl` to debug internal networking between the Web UI and API.
4. and the last step i took was i l created an intance in the private subnet, then i tried to access the ECR from there through the NAT gatway, and of course assigning an IAM role to it. 

_Image placeholder for connectivity testing commands._

---

##  Debugging Tools and Techniques

1. **CloudWatch Logs**:
   - Inspected ECS task startup logs for errors.
   - Analyzed ALB target group health check logs.

2. **Security Group Audits**:
   - Verified that inbound and outbound rules allowed traffic between ALB and ECS tasks.

3. **Direct Connectivity Tests**:
   - SSHed into a bastion host to test internal API and Web UI endpoints using `curl`.

_Image placeholder for CloudWatch logs or troubleshooting outputs._

---

##  Key Takeaways

1. **Health checks matter**: Without proper health endpoints, ECS tasks and ALBs can't cooperate, leading to failed deployments.
2. **ALB 503s**: These are often subtle but usually boil down to networking, task readiness, or security group configurationss.
3. ** And yes Pulumi for the win**: IaC makes troubleshooting repeatable deployments much easier. i had different Pulumi versions somewhere in my Locals during this tasks, so i can easily revert to tthe last deployment immidiately i know the last one is bad. 

That being said, I'm still curious to fully understand why the `503` error persisted intermittently despite fixing health checks and adjusting ALB configurations. These are the types of edge cases that highlight the complexity of distributed systems. *My environments are still intact, because i have to reveert back to this to see an end to it*

---

##  Pulumi Scripts

The complete Pulumi scripts for this deployment are available in the repository. Feel free to review them for a detailed breakdown of the infrastructure configuration.

---

##  Possible Modifications=

1. **Enhanced Observability**:
   - Application of more AWS services to help get to the root cause.
   - Add application-level logs for debugging deeper into service interactions.
     

2. **Trying EC2 Run type instead of Fargate**:
   - After this submission, when off work, will try re build another pulumi script that will deploy using ec2 run types this time instead of the fargate tasks, maybe it would expose where the issue is actually from.

---

##  Final Thoughts

This task was a rewarding challenge that put my troubleshooting, infrastructure design, and problem solving skills to the test. Every deployment teaches  something new, and this one was sincerely no difference, HTTP 503  tested my patience, but it reminded me why I love working in this space, sometimes its about finding cpmlex troubleshooting solutions to a rather minor problem.


