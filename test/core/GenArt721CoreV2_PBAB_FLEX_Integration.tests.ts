import { Coder } from "@ethersproject/abi/lib/coders/abstract-coder";
import {
  BN,
  constants,
  expectEvent,
  expectRevert,
  balance,
  ether,
} from "@openzeppelin/test-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  getAccounts,
  assignDefaultConstants,
  deployAndGet,
  deployCoreWithMinterFilter,
} from "../util/common";
import { GenArt721MinterV1V2_Common } from "./GenArt721CoreV1V2.common";

/**
 * These tests are intended to check integration of the MinterFilter suite with
 * the V2 PRTNR core contract.
 * Some basic core tests, and basic functional tests to ensure purchase
 * does in fact mint tokens to purchaser.
 */
describe("GenArt721CoreV2_PBAB_FLEX_Integration", async function () {
  beforeEach(async function () {
    // standard accounts and constants
    this.accounts = await getAccounts();
    await assignDefaultConstants.call(this);
    // deploy and configure minter filter and minter
    ({ genArt721Core: this.genArt721Core, minterFilter: this.minterFilter } =
      await deployCoreWithMinterFilter.call(
        this,
        "GenArt721CoreV2_PBAB_FLEX",
        "MinterFilterV0"
      ));
    this.minter = await deployAndGet.call(this, "MinterSetPriceV1", [
      this.genArt721Core.address,
      this.minterFilter.address,
    ]);
    await this.minterFilter
      .connect(this.accounts.deployer)
      .addApprovedMinter(this.minter.address);
    // add project
    await this.genArt721Core
      .connect(this.accounts.deployer)
      .addProject("name", this.accounts.artist.address, 0);
    await this.genArt721Core
      .connect(this.accounts.deployer)
      .toggleProjectIsActive(this.projectZero);
    await this.genArt721Core
      .connect(this.accounts.artist)
      .updateProjectMaxInvocations(this.projectZero, this.maxInvocations);
    // set project's minter and price
    await this.minter
      .connect(this.accounts.artist)
      .updatePricePerTokenInWei(this.projectZero, this.pricePerTokenInWei);
    await this.minterFilter
      .connect(this.accounts.artist)
      .setMinterForProject(this.projectZero, this.minter.address);
    // get project's info
    this.projectZeroInfo = await this.genArt721Core.projectTokenInfo(
      this.projectZero
    );
  });

  describe("common tests", async function () {
    GenArt721MinterV1V2_Common();
  });

  describe("external asset dependencies", async function () {
    it("can add an external asset dependency", async function () {
      // add external asset dependency to project 0
      await this.genArt721Core
        .connect(this.accounts.artist)
        .addProjectExternalAssetDependency(
          this.projectZero,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo",
          0
        );
      const externalAssetDependencies = await this.genArt721Core
        .connect(this.accounts.artist)
        .projectIdToExternalAssetDependencies(0, 0);
      expect(externalAssetDependencies[0]).to.equal(
        "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo"
      );
      expect(externalAssetDependencies[1]).to.equal(0);
    });

    it("can remove an external asset dependency", async function () {
      // add assets for project 0 at index 0, 1, 2
      await this.genArt721Core
        .connect(this.accounts.artist)
        .addProjectExternalAssetDependency(
          this.projectZero,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo",
          0
        );
      await this.genArt721Core
        .connect(this.accounts.artist)
        .addProjectExternalAssetDependency(
          this.projectZero,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo2",
          1
        );
      await this.genArt721Core
        .connect(this.accounts.artist)
        .addProjectExternalAssetDependency(
          this.projectZero,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo3",
          0
        );
      // remove external asset at index 1
      await this.genArt721Core
        .connect(this.accounts.artist)
        .removeProjectExternalAssetDependency(0, 1);
      // get project external asset info   index 1 (should be info for project formerly at index 2)
      const externalAssetDependency = await this.genArt721Core
        .connect(this.accounts.artist)
        .projectIdToExternalAssetDependencies(0, 1);
      expect(externalAssetDependency[0]).to.equal(
        "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo3"
      );
      expect(externalAssetDependency[1]).to.equal(0);
      // project external asset info at index 2 should revert
      await expectRevert.unspecified(
        this.genArt721Core
          .connect(this.accounts.artist)
          .projectIdToExternalAssetDependencies(0, 2)
      );
    });

    it("can update an external asset dependency", async function () {
      // add assets for project 0 at index 0
      await this.genArt721Core
        .connect(this.accounts.artist)
        .addProjectExternalAssetDependency(
          this.projectZero,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo",
          0
        );
      // get asset info at index 0 for project 0
      const externalAssetDependency = await this.genArt721Core
        .connect(this.accounts.artist)
        .projectIdToExternalAssetDependencies(0, 0);
      expect(externalAssetDependency[0]).to.equal(
        "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo"
      );
      expect(externalAssetDependency[1]).to.equal(0);
      // update asset info at index 0 for project 0
      await this.genArt721Core
        .connect(this.accounts.artist)
        .updateProjectExternalAssetDependency(
          0,
          0,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo2",
          1
        );

      const externalAssetDependency2 = await this.genArt721Core
        .connect(this.accounts.artist)
        .projectIdToExternalAssetDependencies(0, 0);
      expect(externalAssetDependency2[0]).to.equal(
        "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo2"
      );
      expect(externalAssetDependency2[1]).to.equal(1);
    });

    it("can lock a projects external asset dependencies", async function () {
      // add assets for project 0 at index 0
      await this.genArt721Core
        .connect(this.accounts.artist)
        .addProjectExternalAssetDependency(
          this.projectZero,
          "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo",
          0
        );
      // lock external asset dependencies for project 0
      await this.genArt721Core
        .connect(this.accounts.artist)
        .toggleProjectExternalAssetDependenciesAreLocked(0);

      // get asset info at index 0 for project 0
      const externalAssetDependency = await this.genArt721Core
        .connect(this.accounts.artist)
        .projectIdToExternalAssetDependencies(0, 0);

      expect(externalAssetDependency[0]).to.equal(
        "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo"
      );
      expect(externalAssetDependency[1]).to.equal(0);

      await expectRevert(
        this.genArt721Core
          .connect(this.accounts.artist)
          .updateProjectExternalAssetDependency(
            0,
            0,
            "QmbCdEwHebtpLZSRLGnELbJmmVVJQJPfMEVo1vq2QBEoEo2",
            1
          ),
        "Project external asset dependencies are locked"
      );
    });
  });
});
