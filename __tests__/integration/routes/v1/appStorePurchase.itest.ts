import * as chai from 'chai'
import chaiHttp = require('chai-http')
import { testUsers, v1Path } from '../../utils'
const { expect: chaiExpect } = chai
chai.use(chaiHttp)

describe('App Store Purchase endpoint', () => {
  describe('update purchase status', () => {
    const sendBody = {
      transactionReceipt:
        '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'
    }

    test.skip('when a valid transactionReceipt is provided', async (done) => {
      chai
        .request(global.app)
        .post(`${v1Path}/app-store/update-purchase-status`)
        .set('Cookie', testUsers.premium.authCookie)
        .send(sendBody)
        .end((err, res) => {
          chaiExpect(res).to.have.status(200)

          chaiExpect(res.body).to.eql({
            finishedTransactionIds: [
              '1000000601200221',
              '1000000601200796',
              '1000000601201365',
              '1000000601361296',
              '1000000601362204',
              '1000000601363194',
              '1000000601366153',
              '1000000716323860'
            ]
          })

          done()
        })
    })
  })
})
